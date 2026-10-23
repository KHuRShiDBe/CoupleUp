import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import * as coupleService from '../services/supabase/coupleService';
import * as actionsService from '../services/supabase/actionsService';
import * as rewardsService from '../services/supabase/rewardsService';
import * as tasksService from '../services/supabase/tasksService';
import * as goalsService from '../services/supabase/goalsService';
import * as penaltiesService from '../services/supabase/penaltiesService';
import * as actionRequestsService from '../services/supabase/actionRequestsService';
import { subscribeToCouple } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbAction, DbActionRequest, DbCouple, DbGoal, DbPenalty, DbRewardRequest, DbTask, DbUser } from '../types/database';
import { TaskAssignee } from '../types';

export interface PersonalPointsStats {
  balance: number;
  earned: number;
  spent: number;
}

interface CoupleSyncValue {
  loading: boolean;
  error: string | null;
  userId: string | null;
  couple: DbCouple | null;
  partner: DbUser | null;
  actionsList: DbAction[];
  tasks: DbTask[];
  rewardRequests: DbRewardRequest[];
  goals: DbGoal[];
  penalties: DbPenalty[];
  actionRequests: DbActionRequest[];
  pendingRequestsCount: number;
  // Per-user breakdown computed from actionsList (grouped by recipient_id) --
  // couple.points/earned_points/spent_points (from the DB trigger) remain the
  // source of truth for the couple TOTAL; these are derived client-side from
  // the same ledger rows already loaded for History.
  myStats: PersonalPointsStats;
  partnerStats: PersonalPointsStats;
  clearError: () => void;
  refresh: () => Promise<void>;
  createCoupleCode: () => Promise<string | null>;
  joinCoupleByCode: (code: string) => Promise<boolean>;
  leaveCouple: () => Promise<boolean>;
  // Resolves to false (and leaves a friendly message in `error`) on failure,
  // so callers that need to know whether the points actually landed (e.g.
  // AddActionScreen) can branch on the awaited result instead of racing
  // `error`'s own state-update timing.
  addAction: (title: string, points: number, recipientId?: string, type?: 'action' | 'compliment' | 'reward_chest') => Promise<boolean>;
  // Pending version of addAction -- used by AddActionScreen's "quick" tab:
  // the OTHER couple member (never the author, regardless of who
  // recipientId credits) must approve before any points are applied. See
  // respondActionRequest. Resolves to false (friendly message in `error`)
  // on failure, same pattern as addAction/requestReward.
  createActionRequest: (title: string, points: number, recipientId: string) => Promise<boolean>;
  respondActionRequest: (id: string, accept: boolean) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  createTask: (input: { title: string; description: string; points: number; assignee: TaskAssignee }) => Promise<void>;
  // Resolves to false (and leaves a friendly message in `error`) on failure --
  // same pattern as addAction, for callers that branch on success.
  requestReward: (input: { title: string; cost: number; message: string }) => Promise<boolean>;
  respondRewardRequest: (id: string, accept: boolean) => Promise<void>;
  createPenalty: (input: { title: string; points: number }) => Promise<void>;
  respondPenalty: (id: string, accept: boolean) => Promise<void>;
  addToGoal: (goalId: string, amount: number) => Promise<void>;
  createGoal: (input: { title: string; targetPoints: number; icon?: string }) => Promise<void>;
}

const CoupleSyncContext = createContext<CoupleSyncValue | undefined>(undefined);

export const CoupleSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Starts true: Splash waits for this to resolve to `false` (in either
  // branch of refresh() below) before it can safely decide Main vs
  // ConnectPartner -- it must never read a stale "not loading, no couple".
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [couple, setCouple] = useState<DbCouple | null>(null);
  const [partner, setPartner] = useState<DbUser | null>(null);
  const [actionsList, setActionsList] = useState<DbAction[]>([]);
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [rewardRequests, setRewardRequests] = useState<DbRewardRequest[]>([]);
  const [goals, setGoals] = useState<DbGoal[]>([]);
  const [penalties, setPenalties] = useState<DbPenalty[]>([]);
  const [actionRequests, setActionRequests] = useState<DbActionRequest[]>([]);

  const loadCoupleData = useCallback(
    async (coupleId: string) => {
      const [members, actions, tasksRes, rewardReqs, goalsRes, penaltiesRes, actionRequestsRes] = await Promise.all([
        coupleService.getCoupleMembers(coupleId),
        actionsService.listActions(coupleId),
        tasksService.listTasks(coupleId),
        rewardsService.listRewardRequests(coupleId),
        goalsService.listGoals(coupleId),
        penaltiesService.listPenalties(coupleId),
        actionRequestsService.listActionRequests(coupleId),
      ]);

      setActionsList(actions);
      setTasks(tasksRes);
      setRewardRequests(rewardReqs);
      setGoals(goalsRes);
      setPenalties(penaltiesRes);
      setActionRequests(actionRequestsRes);

      const partnerId = members.map((m) => m.user_id).find((id) => id !== userId);
      setPartner(partnerId ? await coupleService.getUserById(partnerId) : null);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      // Signed out (or never signed in): drop any cached couple data instead
      // of leaving a previous session's state sitting in memory.
      setCouple(null);
      setPartner(null);
      setActionsList([]);
      setTasks([]);
      setRewardRequests([]);
      setGoals([]);
      setPenalties([]);
      setActionRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const coupleId = await coupleService.getMyCoupleId(userId);
      if (!coupleId) {
        setCouple(null);
        setPartner(null);
        return;
      }
      const coupleRow = await coupleService.getCouple(coupleId);
      setCouple(coupleRow);
      if (coupleRow) await loadCoupleData(coupleRow.id);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [userId, loadCoupleData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: any change to the couple's row or its actions/tasks/reward_requests/
  // goals/penalties updates local state without the app being restarted.
  useEffect(() => {
    if (!couple?.id) return;
    const coupleId = couple.id;
    return subscribeToCouple(coupleId, {
      onCoupleChange: setCouple,
      // The side that created the code never calls joinCoupleByCode itself --
      // this is how it finds out the partner joined (their join inserts a
      // couple_members row on this couple_id).
      onMembersChange: () => loadCoupleData(coupleId),
      onActionsChange: () => loadCoupleData(coupleId),
      onTasksChange: () => loadCoupleData(coupleId),
      onRewardRequestsChange: () => loadCoupleData(coupleId),
      onGoalsChange: () => loadCoupleData(coupleId),
      onPenaltiesChange: () => loadCoupleData(coupleId),
      onActionRequestsChange: () => loadCoupleData(coupleId),
    });
  }, [couple?.id, loadCoupleData]);

  // Fallback for a missed realtime event (e.g. the socket was dropped while
  // backgrounded): re-check couple/partner state once whenever the app comes
  // back to the foreground, instead of requiring a manual refresh or restart.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const runAction = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
      return null;
    }
  }, []);

  const pendingRequestsCount =
    rewardRequests.filter((r) => r.status === 'pending').length +
    penalties.filter((p) => p.status === 'pending').length +
    tasks.filter((t) => t.assignee !== 'both' && t.status === 'active').length;

  const statsFor = useCallback(
    (targetId: string | null): PersonalPointsStats => {
      if (!targetId) return { balance: 0, earned: 0, spent: 0 };
      let earned = 0;
      let spent = 0;
      for (const a of actionsList) {
        if (a.recipient_id !== targetId) continue;
        if (a.points > 0) earned += a.points;
        else spent += Math.abs(a.points);
      }
      return { balance: earned - spent, earned, spent };
    },
    [actionsList],
  );
  const myStats = statsFor(userId);
  const partnerStats = statsFor(partner?.id ?? null);

  const value = useMemo<CoupleSyncValue>(
    () => ({
      loading,
      error,
      userId,
      couple,
      partner,
      actionsList,
      myStats,
      partnerStats,
      tasks,
      rewardRequests,
      goals,
      penalties,
      actionRequests,
      pendingRequestsCount,
      clearError: () => setError(null),
      refresh,
      createCoupleCode: async () => {
        const result = await runAction(() => coupleService.createCouple());
        if (!result) return null;
        setCouple(result);
        return result.code;
      },
      joinCoupleByCode: async (code: string) => {
        const result = await runAction(() => coupleService.joinCoupleByCode(code));
        if (!result) return false;
        setCouple(result);
        await loadCoupleData(result.id);
        return true;
      },
      leaveCouple: async () => {
        const result = await runAction(() => coupleService.leaveCouple());
        if (result === null) return false;
        setCouple(null);
        setPartner(null);
        setActionsList([]);
        setTasks([]);
        setRewardRequests([]);
        setGoals([]);
        setPenalties([]);
        setActionRequests([]);
        return true;
      },
      addAction: async (title: string, points: number, recipientId?: string, type?: 'action' | 'compliment' | 'reward_chest') => {
        if (!couple) return false;
        const result = await runAction(() => actionsService.applyAction(couple.id, title, points, recipientId, type));
        return result !== null;
      },
      createActionRequest: async (title: string, points: number, recipientId: string) => {
        if (!couple || !userId) return false;
        const result = await runAction(() =>
          actionRequestsService.createActionRequest({ coupleId: couple.id, actorUserId: userId, recipientId, title, points }),
        );
        return result !== null;
      },
      respondActionRequest: async (id: string, accept: boolean) => {
        await runAction(() => actionRequestsService.respondActionRequest(id, accept));
      },
      completeTask: async (taskId: string) => {
        await runAction(() => tasksService.completeTask(taskId));
      },
      createTask: async (input) => {
        if (!couple || !userId) return;
        await runAction(() => tasksService.createTask({ coupleId: couple.id, createdBy: userId, ...input }));
      },
      requestReward: async (input) => {
        if (!couple || !userId) return false;
        const result = await runAction(() => rewardsService.requestReward({ coupleId: couple.id, requestedBy: userId, ...input }));
        return result !== null;
      },
      respondRewardRequest: async (id: string, accept: boolean) => {
        await runAction(() => rewardsService.respondRewardRequest(id, accept));
      },
      createPenalty: async (input) => {
        if (!couple || !userId || !partner) return;
        await runAction(() =>
          penaltiesService.createPenalty({
            coupleId: couple.id,
            createdBy: userId,
            targetUserId: partner.id,
            ...input,
          }),
        );
      },
      respondPenalty: async (id: string, accept: boolean) => {
        await runAction(() => penaltiesService.respondPenalty(id, accept));
      },
      addToGoal: async (goalId: string, amount: number) => {
        await runAction(() => goalsService.addToGoal(goalId, amount));
      },
      createGoal: async (input) => {
        if (!couple) return;
        const result = await runAction(() => goalsService.createGoal({ coupleId: couple.id, ...input }));
        if (result) setGoals((prev) => [result, ...prev]);
      },
    }),
    [
      loading,
      error,
      userId,
      couple,
      partner,
      actionsList,
      myStats,
      partnerStats,
      tasks,
      rewardRequests,
      goals,
      penalties,
      actionRequests,
      pendingRequestsCount,
      refresh,
      runAction,
      loadCoupleData,
    ],
  );

  return <CoupleSyncContext.Provider value={value}>{children}</CoupleSyncContext.Provider>;
};

export const useCoupleSync = (): CoupleSyncValue => {
  const ctx = useContext(CoupleSyncContext);
  if (!ctx) throw new Error('useCoupleSync must be used within CoupleSyncProvider');
  return ctx;
};
