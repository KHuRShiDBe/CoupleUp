import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as remindersService from '../services/supabase/remindersService';
import { subscribeToReminders } from '../services/supabase/realtime';
import { scheduleReminderNotification, cancelReminderNotification } from '../services/notifications/reminderScheduler';
import { computeInitialRemindAt, rollWeeklyForward } from '../utils/reminderRules';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbReminder, ReminderRule, ReminderTargetType } from '../types/database';

interface RemindersValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  reminders: DbReminder[];
  addReminder: (input: {
    targetType: ReminderTargetType;
    targetId?: string;
    title: string;
    rule: ReminderRule;
    specificDate?: string;
  }) => Promise<void>;
  setReminderActive: (id: string, isActive: boolean) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const RemindersContext = createContext<RemindersValue | undefined>(undefined);

export const RemindersProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<DbReminder[]>([]);

  // Rolls any due weekly reminder forward (see rollWeeklyForward) and
  // (re)schedules a local notification for every active reminder. Runs after
  // every load so a reminder that fired while the app was closed gets its
  // next occurrence scheduled instead of silently going stale.
  const syncSchedules = useCallback(async (rows: DbReminder[]) => {
    for (const r of rows) {
      if (!r.is_active) {
        await cancelReminderNotification(r.id);
        continue;
      }
      let remindAt = new Date(r.remind_at);
      if (r.repeat_weekly && remindAt.getTime() <= Date.now()) {
        remindAt = rollWeeklyForward(remindAt);
        try {
          await remindersService.markReminderFired(r.id, remindAt.toISOString());
        } catch {
          // Non-fatal: local schedule below still uses the rolled-forward
          // date even if persisting it fails; the next refresh retries.
        }
      }
      await scheduleReminderNotification({ reminderId: r.id, title: r.title, remindAt });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setReminders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await remindersService.listReminders();
      setReminders(rows);
      await syncSchedules(rows);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [userId, syncSchedules]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToReminders(userId, refresh);
  }, [userId, refresh]);

  const value = useMemo<RemindersValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      reminders,
      addReminder: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const remindAt = computeInitialRemindAt(input.rule, input.specificDate);
          const row = await remindersService.addReminder({
            coupleId,
            userId,
            targetType: input.targetType,
            targetId: input.targetId,
            title: input.title,
            rule: input.rule,
            remindAt: remindAt.toISOString(),
            repeatWeekly: input.rule === 'weekly',
          });
          setReminders((prev) => [...prev, row].sort((a, b) => a.remind_at.localeCompare(b.remind_at)));
          await scheduleReminderNotification({ reminderId: row.id, title: row.title, remindAt });
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      setReminderActive: async (id: string, isActive: boolean) => {
        setError(null);
        try {
          const row = await remindersService.setReminderActive(id, isActive);
          setReminders((prev) => prev.map((r) => (r.id === id ? row : r)));
          if (isActive) {
            await scheduleReminderNotification({ reminderId: row.id, title: row.title, remindAt: new Date(row.remind_at) });
          } else {
            await cancelReminderNotification(id);
          }
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      removeReminder: async (id: string) => {
        setError(null);
        try {
          await cancelReminderNotification(id);
          await remindersService.deleteReminder(id);
          setReminders((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [loading, error, reminders, coupleId, userId, refresh],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
};

export const useReminders = (): RemindersValue => {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders must be used within RemindersProvider');
  return ctx;
};
