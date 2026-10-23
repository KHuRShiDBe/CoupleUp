import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as interactionService from '../services/supabase/interactionService';
import { subscribeToCoupleInteraction } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbCoupleMoment, DbDailyAnswer, DbImportantDate, DbUserMood, ImportantDateType, MoodValue } from '../types/database';

const HISTORY_DAYS = 30;

const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface CoupleInteractionValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  myMood: MoodValue | null;
  partnerMood: MoodValue | null;
  submitMood: (mood: MoodValue) => Promise<void>;
  dailyAnswers: DbDailyAnswer[]; // last 30 days, both partners
  myAnswerToday: string | null;
  partnerAnswerToday: string | null;
  submitAnswer: (answer: string) => Promise<void>;
  moments: DbCoupleMoment[];
  addMoment: (input: { title: string; description?: string; momentDate: string }) => Promise<void>;
  importantDates: DbImportantDate[];
  addImportantDate: (input: { type: ImportantDateType; label: string; date: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const CoupleInteractionContext = createContext<CoupleInteractionValue | undefined>(undefined);

export const CoupleInteractionProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMoods, setUserMoods] = useState<DbUserMood[]>([]);
  const [dailyAnswers, setDailyAnswers] = useState<DbDailyAnswer[]>([]);
  const [moments, setMoments] = useState<DbCoupleMoment[]>([]);
  const [importantDates, setImportantDates] = useState<DbImportantDate[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setUserMoods([]);
      setDailyAnswers([]);
      setMoments([]);
      setImportantDates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const since = daysAgoIso(HISTORY_DAYS);
      const [moods, answers, momentsList, datesList] = await Promise.all([
        interactionService.listUserMoods(coupleId),
        interactionService.listDailyAnswers(coupleId, since),
        interactionService.listMoments(coupleId),
        interactionService.listImportantDates(coupleId),
      ]);
      setUserMoods(moods);
      setDailyAnswers(answers);
      setMoments(momentsList);
      setImportantDates(datesList);
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
    return subscribeToCoupleInteraction(coupleId, {
      onMoodChange: refresh,
      onAnswerChange: refresh,
      onMomentsChange: refresh,
      onImportantDatesChange: refresh,
    });
  }, [coupleId, refresh]);

  const today = todayIso();
  const myMood = userMoods.find((m) => m.user_id === userId)?.mood ?? null;
  const partnerMood = userMoods.find((m) => m.user_id === sync.partner?.id)?.mood ?? null;
  const myAnswerToday = dailyAnswers.find((a) => a.user_id === userId && a.question_date === today)?.answer ?? null;
  const partnerAnswerToday =
    dailyAnswers.find((a) => a.user_id === sync.partner?.id && a.question_date === today)?.answer ?? null;

  const value = useMemo<CoupleInteractionValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      myMood,
      partnerMood,
      submitMood: async (mood: MoodValue) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await interactionService.setMyMood(coupleId, userId, mood);
          setUserMoods((prev) => [row, ...prev.filter((m) => m.user_id !== row.user_id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      dailyAnswers,
      myAnswerToday,
      partnerAnswerToday,
      submitAnswer: async (answer: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await interactionService.submitDailyAnswer(coupleId, userId, answer);
          setDailyAnswers((prev) => [row, ...prev.filter((a) => a.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      moments,
      addMoment: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await interactionService.addMoment({ coupleId, authorId: userId, ...input });
          setMoments((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      importantDates,
      addImportantDate: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await interactionService.addImportantDate({ coupleId, createdBy: userId, ...input });
          setImportantDates((prev) => [...prev, row].sort((a, b) => a.date.localeCompare(b.date)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [
      loading,
      error,
      myMood,
      partnerMood,
      dailyAnswers,
      myAnswerToday,
      partnerAnswerToday,
      moments,
      importantDates,
      refresh,
      coupleId,
      userId,
    ],
  );

  return <CoupleInteractionContext.Provider value={value}>{children}</CoupleInteractionContext.Provider>;
};

export const useCoupleInteraction = (): CoupleInteractionValue => {
  const ctx = useContext(CoupleInteractionContext);
  if (!ctx) throw new Error('useCoupleInteraction must be used within CoupleInteractionProvider');
  return ctx;
};
