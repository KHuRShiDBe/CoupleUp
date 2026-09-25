import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as planningService from '../services/supabase/planningService';
import { subscribeToPlanning } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import {
  DbDateIdeaSave,
  DbHabit,
  DbHabitLog,
  DbPlanItem,
  DbPromise,
  DbWant,
  HabitFrequency,
  PlanBucket,
  PlanItemKind,
  PromiseStatus,
  WantKind,
} from '../types/database';
import { TaskAssignee } from '../types';

interface PlanningValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  habits: DbHabit[];
  habitLogs: DbHabitLog[];
  addHabit: (input: { title: string; description?: string; frequency: HabitFrequency; assignee: TaskAssignee }) => Promise<void>;
  logHabit: (habitId: string) => Promise<void>;
  promises: DbPromise[];
  addPromise: (title: string) => Promise<void>;
  updatePromiseStatus: (id: string, status: PromiseStatus) => Promise<void>;
  // Completion only -- goes through the complete_promise RPC (migration
  // 0016), which atomically guards against double-completion and awards the
  // points server-side. Use this instead of updatePromiseStatus(id,
  // 'completed') so a double-tap/retry can never double-award.
  // `historyTitle` is the already-localized ledger entry text (the RPC has
  // no notion of the caller's language).
  completePromise: (id: string, historyTitle?: string) => Promise<void>;
  dateIdeaSaves: DbDateIdeaSave[];
  saveDateIdea: (input: { ideaKey?: string; title: string; category: string; priceUsd?: number }) => Promise<void>;
  wants: DbWant[];
  addWant: (kind: WantKind, text: string) => Promise<void>;
  planItems: DbPlanItem[];
  addPlanItem: (input: { kind: PlanItemKind; title: string; bucket: PlanBucket }) => Promise<void>;
  setPlanItemDone: (id: string, done: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const PlanningContext = createContext<PlanningValue | undefined>(undefined);

export const PlanningProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [habits, setHabits] = useState<DbHabit[]>([]);
  const [habitLogs, setHabitLogs] = useState<DbHabitLog[]>([]);
  const [promises, setPromises] = useState<DbPromise[]>([]);
  const [dateIdeaSaves, setDateIdeaSaves] = useState<DbDateIdeaSave[]>([]);
  const [wants, setWants] = useState<DbWant[]>([]);
  const [planItems, setPlanItems] = useState<DbPlanItem[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setHabits([]);
      setHabitLogs([]);
      setPromises([]);
      setDateIdeaSaves([]);
      setWants([]);
      setPlanItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [h, hl, p, dis, w, pi] = await Promise.all([
        planningService.listHabits(coupleId),
        planningService.listHabitLogs(coupleId),
        planningService.listPromises(coupleId),
        planningService.listDateIdeaSaves(coupleId),
        planningService.listWants(coupleId),
        planningService.listPlanItems(coupleId),
      ]);
      setHabits(h);
      setHabitLogs(hl);
      setPromises(p);
      setDateIdeaSaves(dis);
      setWants(w);
      setPlanItems(pi);
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
    return subscribeToPlanning(coupleId, {
      onHabitsChange: refresh,
      onHabitLogsChange: refresh,
      onPromisesChange: refresh,
      onDateIdeaSavesChange: refresh,
      onWantsChange: refresh,
      onPlanItemsChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<PlanningValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      habits,
      habitLogs,
      addHabit: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await planningService.addHabit({ coupleId, createdBy: userId, ...input });
          setHabits((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      logHabit: async (habitId: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await planningService.logHabit(habitId, coupleId, userId);
          setHabitLogs((prev) => [row, ...prev.filter((l) => l.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      promises,
      addPromise: async (title: string) => {
        if (!coupleId || !userId || !sync.partner) return;
        setError(null);
        try {
          const row = await planningService.addPromise({ coupleId, fromUserId: userId, toUserId: sync.partner.id, title });
          setPromises((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      updatePromiseStatus: async (id: string, status: PromiseStatus) => {
        setError(null);
        try {
          const row = await planningService.updatePromiseStatus(id, status);
          setPromises((prev) => prev.map((p) => (p.id === id ? row : p)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      completePromise: async (id: string, historyTitle?: string) => {
        setError(null);
        try {
          const row = await planningService.completePromise(id, historyTitle);
          setPromises((prev) => prev.map((p) => (p.id === id ? row : p)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      dateIdeaSaves,
      saveDateIdea: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await planningService.saveDateIdea({ coupleId, createdBy: userId, ...input });
          setDateIdeaSaves((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      wants,
      addWant: async (kind: WantKind, text: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await planningService.addWant({ coupleId, userId, kind, text });
          setWants((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      planItems,
      addPlanItem: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await planningService.addPlanItem({ coupleId, createdBy: userId, ...input });
          setPlanItems((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      setPlanItemDone: async (id: string, done: boolean) => {
        setError(null);
        try {
          const row = await planningService.setPlanItemDone(id, done);
          setPlanItems((prev) => prev.map((p) => (p.id === id ? row : p)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [loading, error, habits, habitLogs, promises, dateIdeaSaves, wants, planItems, refresh, coupleId, userId, sync.partner],
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
};

export const usePlanning = (): PlanningValue => {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error('usePlanning must be used within PlanningProvider');
  return ctx;
};
