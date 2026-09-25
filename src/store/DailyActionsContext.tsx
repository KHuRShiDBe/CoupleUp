import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as dailyActionsService from '../services/supabase/dailyActionsService';
import { subscribeToDailyActions } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbDailyActionCompletion, DbDailyProgress } from '../types/database';

interface DailyActionsValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  completions: DbDailyActionCompletion[];
  progress: DbDailyProgress[];
  completeAction: (actionId: string, actionDate: string, points: number, title: string) => Promise<boolean>;
  claimBonus: (actionDate: string, requiredCount: number, bonusPoints: number, title: string) => Promise<boolean>;
  spinWheel: (actionDate: string, title: string) => Promise<number | null>;
  refresh: () => Promise<void>;
}

const DailyActionsContext = createContext<DailyActionsValue | undefined>(undefined);

export const DailyActionsProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<DbDailyActionCompletion[]>([]);
  const [progress, setProgress] = useState<DbDailyProgress[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setCompletions([]);
      setProgress([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [c, p] = await Promise.all([
        dailyActionsService.listDailyActionCompletions(coupleId),
        dailyActionsService.listDailyProgress(coupleId),
      ]);
      setCompletions(c);
      setProgress(p);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToDailyActions(coupleId, {
      onCompletionsChange: refresh,
      onProgressChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<DailyActionsValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      completions,
      progress,
      completeAction: async (actionId: string, actionDate: string, points: number, title: string) => {
        if (!coupleId || !userId) return false;
        setError(null);
        try {
          const ok = await dailyActionsService.completeDailyAction({ coupleId, actionId, actionDate, points, title });
          if (ok) await refresh();
          return ok;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      claimBonus: async (actionDate: string, requiredCount: number, bonusPoints: number, title: string) => {
        if (!coupleId) return false;
        setError(null);
        try {
          const ok = await dailyActionsService.claimDailyBonus({ coupleId, actionDate, requiredCount, bonusPoints, title });
          if (ok) await refresh();
          return ok;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      spinWheel: async (actionDate: string, title: string) => {
        if (!coupleId) return null;
        setError(null);
        try {
          const reward = await dailyActionsService.spinDailyRewardWheel({ coupleId, actionDate, title });
          await refresh();
          return reward;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return null;
        }
      },
      refresh,
    }),
    [loading, error, completions, progress, coupleId, userId, refresh],
  );

  return <DailyActionsContext.Provider value={value}>{children}</DailyActionsContext.Provider>;
};

export const useDailyActions = (): DailyActionsValue => {
  const ctx = useContext(DailyActionsContext);
  if (!ctx) throw new Error('useDailyActions must be used within DailyActionsProvider');
  return ctx;
};
