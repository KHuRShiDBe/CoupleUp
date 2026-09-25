import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as progressionService from '../services/supabase/progressionService';
import { subscribeToProgression } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbAchievementUnlock, DbChallengeProgress, DbDailyChallenge, DbQuizAnswer, DbRewardClaim } from '../types/database';
import { getWeekKey } from '../constants/weeklyChallenges';

interface ProgressionValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  weekKey: string;
  challengeProgress: DbChallengeProgress[];
  totalCompletedChallenges: number;
  completeChallenge: (challengeKey: string) => Promise<DbChallengeProgress | null>;
  markChallengeRewardClaimed: (id: string) => Promise<void>;
  // Atomic complete+claim (RPC claim_challenge_reward, migration 0017) --
  // use this instead of completeChallenge + markChallengeRewardClaimed for
  // the actual "Claim" action, so the bonus can never be paid out twice.
  claimChallengeReward: (challengeKey: string, rewardPoints: number, title: string) => Promise<void>;
  todayDailyChallenge: DbDailyChallenge | null;
  // Atomic complete+claim (RPC complete_daily_challenge, migration 0017) --
  // the points grant now happens server-side, guarded, instead of a separate
  // unguarded sync.addAction() call after this resolves.
  completeDailyChallenge: (rewardPoints: number, title: string) => Promise<void>;
  achievementUnlocks: DbAchievementUnlock[];
  unlockAchievement: (achievementKey: string) => Promise<void>;
  rewardClaims: DbRewardClaim[];
  claimReward: (milestoneKey: string, pointsAwarded: number) => Promise<DbRewardClaim | null>;
  quizAnswers: DbQuizAnswer[];
  submitQuizAnswer: (questionKey: string, answer: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ProgressionContext = createContext<ProgressionValue | undefined>(undefined);

export const ProgressionProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;
  const weekKey = getWeekKey();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeProgress, setChallengeProgress] = useState<DbChallengeProgress[]>([]);
  const [totalCompletedChallenges, setTotalCompletedChallenges] = useState(0);
  const [todayDailyChallenge, setTodayDailyChallenge] = useState<DbDailyChallenge | null>(null);
  const [achievementUnlocks, setAchievementUnlocks] = useState<DbAchievementUnlock[]>([]);
  const [rewardClaims, setRewardClaims] = useState<DbRewardClaim[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<DbQuizAnswer[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setChallengeProgress([]);
      setTodayDailyChallenge(null);
      setAchievementUnlocks([]);
      setRewardClaims([]);
      setQuizAnswers([]);
      setTotalCompletedChallenges(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cp, dc, au, rc, qa, tcc] = await Promise.all([
        progressionService.listChallengeProgress(coupleId, weekKey),
        progressionService.getTodayDailyChallenge(coupleId),
        progressionService.listAchievementUnlocks(coupleId),
        progressionService.listRewardClaims(coupleId),
        progressionService.listQuizAnswers(coupleId),
        progressionService.countCompletedChallenges(coupleId),
      ]);
      setChallengeProgress(cp);
      setTodayDailyChallenge(dc);
      setAchievementUnlocks(au);
      setRewardClaims(rc);
      setQuizAnswers(qa);
      setTotalCompletedChallenges(tcc);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId, weekKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToProgression(coupleId, {
      onChallengeProgressChange: refresh,
      onDailyChallengeChange: refresh,
      onAchievementUnlocksChange: refresh,
      onRewardClaimsChange: refresh,
      onQuizAnswersChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<ProgressionValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      weekKey,
      challengeProgress,
      totalCompletedChallenges,
      completeChallenge: async (challengeKey: string) => {
        if (!coupleId) return null;
        setError(null);
        try {
          const row = await progressionService.completeChallenge(coupleId, weekKey, challengeKey);
          setChallengeProgress((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
          return row;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return null;
        }
      },
      markChallengeRewardClaimed: async (id: string) => {
        setError(null);
        try {
          const row = await progressionService.markChallengeRewardClaimed(id);
          setChallengeProgress((prev) => prev.map((c) => (c.id === id ? row : c)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      claimChallengeReward: async (challengeKey: string, rewardPoints: number, title: string) => {
        if (!coupleId) return;
        setError(null);
        try {
          const row = await progressionService.claimChallengeReward({
            coupleId,
            weekKey,
            challengeKey,
            rewardPoints,
            title,
          });
          setChallengeProgress((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      todayDailyChallenge,
      completeDailyChallenge: async (rewardPoints: number, title: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await progressionService.completeDailyChallengeAtomic({ coupleId, rewardPoints, title });
          setTodayDailyChallenge(row);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      achievementUnlocks,
      unlockAchievement: async (achievementKey: string) => {
        if (!coupleId) return;
        try {
          const row = await progressionService.unlockAchievement(coupleId, achievementKey);
          if (row) setAchievementUnlocks((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      rewardClaims,
      claimReward: async (milestoneKey: string, pointsAwarded: number) => {
        if (!coupleId || !userId) return null;
        setError(null);
        try {
          const row = await progressionService.claimReward({ coupleId, milestoneKey, pointsAwarded, claimedBy: userId });
          if (row) setRewardClaims((prev) => [row, ...prev]);
          return row;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return null;
        }
      },
      quizAnswers,
      submitQuizAnswer: async (questionKey: string, answer: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await progressionService.submitQuizAnswer(coupleId, userId, questionKey, answer);
          setQuizAnswers((prev) => [row, ...prev.filter((a) => a.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [
      loading,
      error,
      weekKey,
      challengeProgress,
      totalCompletedChallenges,
      todayDailyChallenge,
      achievementUnlocks,
      rewardClaims,
      quizAnswers,
      refresh,
      coupleId,
      userId,
    ],
  );

  return <ProgressionContext.Provider value={value}>{children}</ProgressionContext.Provider>;
};

export const useProgression = (): ProgressionValue => {
  const ctx = useContext(ProgressionContext);
  if (!ctx) throw new Error('useProgression must be used within ProgressionProvider');
  return ctx;
};
