import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as gamesService from '../services/supabase/gamesService';
import { subscribeToGames } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbEitherOrChoice, DbGameRewardClaim, DbPartnerQuizAnswer, DbTruthOrDareProgress, TruthOrDareKind } from '../types/database';

interface GamesValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  partnerQuizAnswers: DbPartnerQuizAnswer[];
  submitPartnerQuizAnswer: (quizId: string, questionIndex: number, selectedIndex: number) => Promise<void>;
  eitherOrChoices: DbEitherOrChoice[];
  submitEitherOrChoice: (pairIndex: number, choice: string) => Promise<void>;
  truthOrDareProgress: DbTruthOrDareProgress | null;
  setTruthOrDareKind: (kind: TruthOrDareKind) => Promise<void>;
  advanceTruthOrDare: (totalRounds: number, rewardPoints: number, title: string) => Promise<void>;
  gameRewardClaims: DbGameRewardClaim[];
  claimGameReward: (gameKey: string, points: number, title: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const GamesContext = createContext<GamesValue | undefined>(undefined);

export const GamesProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerQuizAnswers, setPartnerQuizAnswers] = useState<DbPartnerQuizAnswer[]>([]);
  const [eitherOrChoices, setEitherOrChoices] = useState<DbEitherOrChoice[]>([]);
  const [truthOrDareProgress, setTruthOrDareProgress] = useState<DbTruthOrDareProgress | null>(null);
  const [gameRewardClaims, setGameRewardClaims] = useState<DbGameRewardClaim[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setPartnerQuizAnswers([]);
      setEitherOrChoices([]);
      setTruthOrDareProgress(null);
      setGameRewardClaims([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pq, eo, tod, claims] = await Promise.all([
        gamesService.listPartnerQuizAnswers(coupleId),
        gamesService.listEitherOrChoices(coupleId),
        gamesService.getTruthOrDareProgress(coupleId),
        gamesService.listGameRewardClaims(coupleId),
      ]);
      setPartnerQuizAnswers(pq);
      setEitherOrChoices(eo);
      setTruthOrDareProgress(tod);
      setGameRewardClaims(claims);
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
    return subscribeToGames(coupleId, {
      onPartnerQuizAnswersChange: refresh,
      onEitherOrChoicesChange: refresh,
      onTruthOrDareProgressChange: refresh,
      onGameRewardClaimsChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<GamesValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      partnerQuizAnswers,
      submitPartnerQuizAnswer: async (quizId: string, questionIndex: number, selectedIndex: number) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await gamesService.submitPartnerQuizAnswer({ coupleId, quizId, questionIndex, userId, selectedIndex });
          setPartnerQuizAnswers((prev) => [row, ...prev.filter((a) => a.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      eitherOrChoices,
      submitEitherOrChoice: async (pairIndex: number, choice: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await gamesService.submitEitherOrChoice({ coupleId, pairIndex, userId, choice });
          setEitherOrChoices((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      truthOrDareProgress,
      setTruthOrDareKind: async (kind: TruthOrDareKind) => {
        if (!coupleId) return;
        setError(null);
        try {
          const row = await gamesService.setTruthOrDareKind(coupleId, kind);
          setTruthOrDareProgress(row);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      advanceTruthOrDare: async (totalRounds: number, rewardPoints: number, title: string) => {
        if (!coupleId) return;
        setError(null);
        try {
          const row = await gamesService.advanceTruthOrDare({ coupleId, totalRounds, rewardPoints, title });
          setTruthOrDareProgress(row);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      gameRewardClaims,
      claimGameReward: async (gameKey: string, points: number, title: string) => {
        if (!coupleId) return false;
        setError(null);
        try {
          const claimed = await gamesService.claimGameReward({ coupleId, gameKey, points, title });
          if (claimed) await refresh();
          return claimed;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      refresh,
    }),
    [loading, error, partnerQuizAnswers, eitherOrChoices, truthOrDareProgress, gameRewardClaims, coupleId, userId, refresh],
  );

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>;
};

export const useGames = (): GamesValue => {
  const ctx = useContext(GamesContext);
  if (!ctx) throw new Error('useGames must be used within GamesProvider');
  return ctx;
};
