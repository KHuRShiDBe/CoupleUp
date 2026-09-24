import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Achievement,
  ActionHistoryItem,
  AppContextValue,
  AppState,
  GameHistoryEntry,
  NotificationPreferences,
  Penalty,
  RewardRequest,
  Role,
  SupportEntry,
  Task,
  TaskAssignee,
  WishlistItem,
  WishlistPriority,
} from '../types';
import { computeCoupleLevel, getDailyChallenge, getDailyQuestion } from '../constants/gameContent';
import { DECORATIONS } from '../constants/decorations';
import { Language } from '../localization';

// v2: earlier versions seeded new installs with fake demo progress (points,
// history, tasks, goals, streak). Bumping the key means anyone with that old
// seed data on disk simply starts clean instead of it being migrated forward.
const STORAGE_KEY = 'coupleup:app-state:v2';

const defaultNotificationPreferences: NotificationPreferences = {
  actions: true,
  rewardRequests: true,
  penalties: true,
  tasks: true,
  goals: true,
  achievements: true,
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const initialState: AppState = {
  isReady: false,
  onboardingComplete: false,
  selectedRole: null,
  selectedAvatar: null,
  userName: 'Ты',
  points: 0,
  earnedPoints: 0,
  spentPoints: 0,
  lastAction: null,
  history: [],
  rewardRequests: [],
  tasks: [],
  completedTasks: [],
  penalties: [],
  sharedGoals: [],
  wishlist: [],
  coupleStreak: 0,
  bestCoupleStreak: 0,
  lastActivityDate: null,
  notificationPreferences: defaultNotificationPreferences,
  gameHistory: [],
  dailyQuestionAnswer: null,
  questionAnsweredDays: 0,
  dailyRewardDate: null,
  dailyChallengeStreak: 0,
  lastGameRewardDate: null,
  ownedThemes: [],
  selectedPremiumTheme: null,
  ownedDecorations: [],
  selectedDecoration: 'classic',
  supportHistory: [],
  language: 'ru',
  languageSelected: false,
};

type PersistedState = Pick<
  AppState,
  | 'onboardingComplete'
  | 'selectedRole'
  | 'selectedAvatar'
  | 'userName'
  | 'points'
  | 'earnedPoints'
  | 'spentPoints'
  | 'history'
  | 'lastAction'
  | 'rewardRequests'
  | 'tasks'
  | 'completedTasks'
  | 'penalties'
  | 'sharedGoals'
  | 'wishlist'
  | 'coupleStreak'
  | 'bestCoupleStreak'
  | 'lastActivityDate'
  | 'notificationPreferences'
  | 'gameHistory'
  | 'dailyQuestionAnswer'
  | 'questionAnsweredDays'
  | 'dailyRewardDate'
  | 'dailyChallengeStreak'
  | 'lastGameRewardDate'
  | 'ownedThemes'
  | 'selectedPremiumTheme'
  | 'ownedDecorations'
  | 'selectedDecoration'
  | 'supportHistory'
  | 'language'
  | 'languageSelected'
>;

const toPersistedState = (state: AppState): PersistedState => ({
  onboardingComplete: state.onboardingComplete,
  selectedRole: state.selectedRole,
  selectedAvatar: state.selectedAvatar,
  userName: state.userName,
  points: state.points,
  earnedPoints: state.earnedPoints,
  spentPoints: state.spentPoints,
  history: state.history,
  lastAction: state.lastAction,
  rewardRequests: state.rewardRequests,
  tasks: state.tasks,
  completedTasks: state.completedTasks,
  penalties: state.penalties,
  sharedGoals: state.sharedGoals,
  wishlist: state.wishlist,
  coupleStreak: state.coupleStreak,
  bestCoupleStreak: state.bestCoupleStreak,
  lastActivityDate: state.lastActivityDate,
  notificationPreferences: state.notificationPreferences,
  gameHistory: state.gameHistory,
  dailyQuestionAnswer: state.dailyQuestionAnswer,
  questionAnsweredDays: state.questionAnsweredDays,
  dailyRewardDate: state.dailyRewardDate,
  dailyChallengeStreak: state.dailyChallengeStreak,
  lastGameRewardDate: state.lastGameRewardDate,
  ownedThemes: state.ownedThemes,
  selectedPremiumTheme: state.selectedPremiumTheme,
  ownedDecorations: state.ownedDecorations,
  selectedDecoration: state.selectedDecoration,
  supportHistory: state.supportHistory,
  language: state.language,
  languageSelected: state.languageSelected,
});

// If there was at least one shared action yesterday, the streak continues; otherwise it resets to 1.
const registerActivity = (prev: AppState): Pick<AppState, 'coupleStreak' | 'bestCoupleStreak' | 'lastActivityDate'> => {
  const today = todayKey();
  if (prev.lastActivityDate === today) {
    return { coupleStreak: prev.coupleStreak, bestCoupleStreak: prev.bestCoupleStreak, lastActivityDate: today };
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const nextStreak = prev.lastActivityDate === yesterday ? prev.coupleStreak + 1 : 1;
  return {
    coupleStreak: nextStreak,
    bestCoupleStreak: Math.max(prev.bestCoupleStreak, nextStreak),
    lastActivityDate: today,
  };
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AppState>(initialState);
  // Latest committed state, so an async action can persist a snapshot without
  // waiting for the persist effect below to run.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const persisted: PersistedState = JSON.parse(raw);
          setState((prev) => ({ ...prev, ...persisted, isReady: true }));
        } else {
          // No v2 data yet -- clear out any leftover v1 seed (old mock demo
          // progress) so it can never be read again, then start clean.
          AsyncStorage.removeItem('coupleup:app-state:v1').catch(() => {});
          setState((prev) => ({ ...prev, isReady: true }));
        }
      } catch {
        setState((prev) => ({ ...prev, isReady: true }));
      }
    })();
  }, []);

  useEffect(() => {
    if (!state.isReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedState(state))).catch(() => {});
  }, [
    state.isReady,
    state.onboardingComplete,
    state.selectedRole,
    state.selectedAvatar,
    state.userName,
    state.points,
    state.earnedPoints,
    state.spentPoints,
    state.history,
    state.lastAction,
    state.rewardRequests,
    state.tasks,
    state.completedTasks,
    state.penalties,
    state.sharedGoals,
    state.wishlist,
    state.coupleStreak,
    state.bestCoupleStreak,
    state.lastActivityDate,
    state.notificationPreferences,
    state.gameHistory,
    state.dailyQuestionAnswer,
    state.questionAnsweredDays,
    state.dailyRewardDate,
    state.dailyChallengeStreak,
    state.lastGameRewardDate,
    state.ownedThemes,
    state.selectedPremiumTheme,
    state.ownedDecorations,
    state.selectedDecoration,
    state.supportHistory,
    state.language,
    state.languageSelected,
  ]);

  const value = useMemo<AppContextValue>(() => {
    // Every achievement starts locked with real progress at 0 -- there is no
    // seeded/pre-unlocked state. `current` is capped to `target` purely for
    // display (e.g. a 1250-point balance still reads as "1000/1000", not an
    // overshoot).
    const achievement = (id: string, title: string, current: number, target: number): Achievement => ({
      id,
      title,
      current: Math.min(current, target),
      target,
      unlocked: current >= target,
    });

    const goodActionsCount = state.history.filter((h) => h.points > 0).length;
    const correctAnswersCount = state.gameHistory.reduce((sum, g) => sum + (g.correctAnswers ?? 0), 0);

    const achievements: Achievement[] = [
      achievement('first100', 'Первые 100 баллов', state.earnedPoints, 100),
      achievement('streak7', '7 дней активности', state.coupleStreak, 7),
      achievement('good10', '10 добрых действий', goodActionsCount, 10),
      achievement('tasks5', '5 выполненных заданий', state.completedTasks.length, 5),
      achievement('points1000', '1000 общих баллов', state.points, 1000),
      achievement('firstGame', 'Первая игра', state.gameHistory.length, 1),
      achievement('fiveGames', '5 игр вместе', state.gameHistory.length, 5),
      achievement('tenCorrect', '10 правильных ответов', correctAnswersCount, 10),
      achievement('sevenQuestions', '7 дней вопросов дня', state.questionAnsweredDays, 7),
      achievement('fiveChallenges', '5 ежедневных заданий подряд', state.dailyChallengeStreak, 5),
    ];

    const pendingRequestsCount =
      state.rewardRequests.filter((r) => r.status === 'pending').length +
      state.penalties.filter((p) => p.status === 'pending').length +
      state.tasks.filter((t) => t.assignee !== 'both').length;

    const today = todayKey();

    return {
      ...state,
      achievements,
      pendingRequestsCount,
      dailyQuestion: getDailyQuestion(),
      dailyChallenge: getDailyChallenge(),
      dailyChallengeCompleted: state.dailyRewardDate === today,
      coupleLevel: computeCoupleLevel(state.earnedPoints),
      actions: {
        setRole: (role: Role) => setState((prev) => ({ ...prev, selectedRole: role })),
        setAvatar: (avatarId: number) => setState((prev) => ({ ...prev, selectedAvatar: avatarId })),
        setUserName: (name: string) => setState((prev) => ({ ...prev, userName: name })),
        // Writes the completed flag to storage *before* updating state, so a
        // navigation that follows the returned promise (e.g. back to Splash)
        // never sees -- and a relaunch never reloads -- the pre-onboarding state.
        completeOnboarding: async (patch = {}) => {
          const next: AppState = { ...stateRef.current, ...patch, onboardingComplete: true };
          try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedState(next)));
          } catch {
            // Storage failure only costs persistence across relaunch; the
            // in-memory flag below still lets this session continue.
          }
          setState((prev) => ({ ...prev, ...patch, onboardingComplete: true }));
        },
        addAction: (title: string, points: number, authorRole?: Role) =>
          setState((prev) => {
            const item: ActionHistoryItem = {
              id: String(Date.now()),
              title,
              points,
              date: 'Только что',
              authorRole: authorRole ?? prev.selectedRole ?? 'male',
            };
            return {
              ...prev,
              ...registerActivity(prev),
              lastAction: item,
              history: [item, ...prev.history],
              points: prev.points + points,
              earnedPoints: points > 0 ? prev.earnedPoints + points : prev.earnedPoints,
              spentPoints: points < 0 ? prev.spentPoints + Math.abs(points) : prev.spentPoints,
            };
          }),
        requestReward: (reward: { id: string; title: string; cost: number }, message: string, rateSnapshot?: number) =>
          setState((prev) => {
            const request: RewardRequest = {
              id: String(Date.now()),
              rewardId: reward.id,
              title: reward.title,
              cost: reward.cost,
              message,
              date: 'Только что',
              createdAt: new Date().toISOString(),
              status: 'pending',
              kind: 'catalog',
              rateSnapshot,
            };
            return { ...prev, rewardRequests: [request, ...prev.rewardRequests] };
          }),
        createCustomRequest: (input) =>
          setState((prev) => {
            const request: RewardRequest = {
              id: String(Date.now()),
              rewardId: input.kind,
              title: input.title,
              description: input.description,
              cost: input.requiredPoints,
              message: input.message,
              date: 'Только что',
              createdAt: new Date().toISOString(),
              status: 'pending',
              kind: input.kind,
              rateSnapshot: input.rateSnapshot,
              dollarAmount: input.dollarAmount,
              bondAmount: input.bondAmount,
            };
            return { ...prev, rewardRequests: [request, ...prev.rewardRequests] };
          }),
        respondRewardRequest: (requestId: string, accept: boolean) =>
          setState((prev) => {
            const request = prev.rewardRequests.find((r) => r.id === requestId);
            if (!request || request.status !== 'pending') return prev;
            const updatedRequests = prev.rewardRequests.map((r) =>
              r.id === requestId ? { ...r, status: accept ? ('accepted' as const) : ('declined' as const) } : r,
            );
            if (!accept) return { ...prev, rewardRequests: updatedRequests };
            return {
              ...prev,
              rewardRequests: updatedRequests,
              points: prev.points - request.cost,
              spentPoints: prev.spentPoints + request.cost,
            };
          }),
        completeTask: (taskId: string) =>
          setState((prev) => {
            const task = prev.tasks.find((t) => t.id === taskId);
            if (!task) return prev;
            const partnerRole: Role = prev.selectedRole === 'female' ? 'male' : 'female';
            const authorRole: Role = task.assignee === 'partner' ? partnerRole : prev.selectedRole ?? 'male';
            const item: ActionHistoryItem = {
              id: String(Date.now()),
              title: task.title,
              points: task.points,
              date: 'Только что',
              authorRole,
            };
            return {
              ...prev,
              ...registerActivity(prev),
              tasks: prev.tasks.filter((t) => t.id !== taskId),
              completedTasks: [{ ...task, status: 'completed', completedAt: new Date().toISOString() }, ...prev.completedTasks],
              lastAction: item,
              history: [item, ...prev.history],
              points: prev.points + task.points,
              earnedPoints: prev.earnedPoints + task.points,
            };
          }),
        createTask: (input: { title: string; description: string; points: number; assignee: TaskAssignee }) =>
          setState((prev) => {
            const task: Task = {
              id: String(Date.now()),
              title: input.title,
              description: input.description,
              points: input.points,
              createdBy: prev.selectedRole ?? 'male',
              assignee: input.assignee,
              status: 'active',
            };
            return { ...prev, tasks: [task, ...prev.tasks] };
          }),
        respondTaskRequest: (taskId: string, accept: boolean) =>
          setState((prev) => {
            if (accept) return prev; // task stays active; this just acknowledges the request.
            return { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) };
          }),
        createPenalty: (input: { title: string; points: number }) =>
          setState((prev) => {
            const partnerRole: Role = prev.selectedRole === 'female' ? 'male' : 'female';
            const penalty: Penalty = {
              id: String(Date.now()),
              title: input.title,
              points: input.points,
              targetRole: partnerRole,
              status: 'pending',
              date: 'Только что',
            };
            return { ...prev, penalties: [penalty, ...prev.penalties] };
          }),
        respondPenalty: (penaltyId: string, accept: boolean) =>
          setState((prev) => {
            const penalty = prev.penalties.find((p) => p.id === penaltyId);
            if (!penalty || penalty.status !== 'pending') return prev;
            const updatedPenalties = prev.penalties.map((p) =>
              p.id === penaltyId ? { ...p, status: accept ? ('confirmed' as const) : ('rejected' as const) } : p,
            );
            if (!accept) return { ...prev, penalties: updatedPenalties };
            const item: ActionHistoryItem = {
              id: String(Date.now()),
              title: penalty.title,
              points: -penalty.points,
              date: 'Только что',
              authorRole: penalty.targetRole,
            };
            return {
              ...prev,
              ...registerActivity(prev),
              penalties: updatedPenalties,
              lastAction: item,
              history: [item, ...prev.history],
              points: prev.points - penalty.points,
              spentPoints: prev.spentPoints + penalty.points,
            };
          }),
        addToGoal: (goalId: string, amount: number) =>
          setState((prev) => {
            const goal = prev.sharedGoals.find((g) => g.id === goalId);
            if (!goal) return prev;
            const room = goal.targetPoints - goal.currentPoints;
            const applied = Math.min(amount, room, prev.points);
            if (applied <= 0) return prev;
            return {
              ...prev,
              points: prev.points - applied,
              spentPoints: prev.spentPoints + applied,
              sharedGoals: prev.sharedGoals.map((g) => {
                if (g.id !== goalId) return g;
                const nextCurrent = g.currentPoints + applied;
                const justCompleted = !g.completedAt && nextCurrent >= g.targetPoints;
                return {
                  ...g,
                  currentPoints: nextCurrent,
                  completedAt: justCompleted ? new Date().toISOString() : g.completedAt,
                };
              }),
            };
          }),
        addWishlistItem: (input: { title: string; priceUsd: number; priority: WishlistPriority }) =>
          setState((prev) => {
            const item: WishlistItem = {
              id: String(Date.now()),
              title: input.title,
              priceUsd: input.priceUsd,
              priority: input.priority,
              createdAt: new Date().toISOString(),
            };
            return { ...prev, wishlist: [item, ...prev.wishlist] };
          }),
        removeWishlistItem: (id: string) =>
          setState((prev) => ({ ...prev, wishlist: prev.wishlist.filter((w) => w.id !== id) })),
        setNotificationPreference: (key, value: boolean) =>
          setState((prev) => ({
            ...prev,
            notificationPreferences: { ...prev.notificationPreferences, [key]: value },
          })),
        // Only the first game played each day earns points -- replaying the
        // same (or another) game later that day still logs to gameHistory
        // (0 points) so it can't be farmed for infinite rewards.
        recordGameResult: (game: string, result: string, points: number, correctAnswers?: number) =>
          setState((prev) => {
            const today = todayKey();
            const alreadyRewarded = prev.lastGameRewardDate === today;
            const appliedPoints = alreadyRewarded ? 0 : Math.max(0, points);
            const now = Date.now();
            const entry: GameHistoryEntry = {
              id: String(now),
              game,
              date: 'Только что',
              result,
              points: appliedPoints,
              correctAnswers,
            };
            if (appliedPoints <= 0) {
              return { ...prev, gameHistory: [entry, ...prev.gameHistory] };
            }
            const item: ActionHistoryItem = {
              id: String(now + 1),
              title: `Игра: ${game}`,
              points: appliedPoints,
              date: 'Только что',
              authorRole: prev.selectedRole ?? 'male',
            };
            return {
              ...prev,
              ...registerActivity(prev),
              gameHistory: [entry, ...prev.gameHistory],
              lastGameRewardDate: today,
              lastAction: item,
              history: [item, ...prev.history],
              points: prev.points + appliedPoints,
              earnedPoints: prev.earnedPoints + appliedPoints,
            };
          }),
        answerDailyQuestion: (answer: string) =>
          setState((prev) => {
            const today = todayKey();
            const isNewDay = prev.dailyQuestionAnswer?.date !== today;
            return {
              ...prev,
              dailyQuestionAnswer: { date: today, answer },
              questionAnsweredDays: isNewDay ? prev.questionAnsweredDays + 1 : prev.questionAnsweredDays,
            };
          }),
        // Daily challenge pays out once per day and extends its own
        // consecutive-day streak (separate from the couple activity streak).
        completeDailyChallenge: () =>
          setState((prev) => {
            const today = todayKey();
            if (prev.dailyRewardDate === today) return prev;
            const REWARD = 8;
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            const nextChallengeStreak = prev.dailyRewardDate === yesterday ? prev.dailyChallengeStreak + 1 : 1;
            const item: ActionHistoryItem = {
              id: String(Date.now()),
              title: `Задание дня: ${getDailyChallenge()}`,
              points: REWARD,
              date: 'Только что',
              authorRole: prev.selectedRole ?? 'male',
            };
            return {
              ...prev,
              ...registerActivity(prev),
              dailyRewardDate: today,
              dailyChallengeStreak: nextChallengeStreak,
              lastAction: item,
              history: [item, ...prev.history],
              points: prev.points + REWARD,
              earnedPoints: prev.earnedPoints + REWARD,
            };
          }),
        // Mock purchase only -- no real payment provider is wired up.
        purchasePremiumTheme: (themeId) =>
          setState((prev) =>
            prev.ownedThemes.includes(themeId)
              ? prev
              : { ...prev, ownedThemes: [...prev.ownedThemes, themeId] },
          ),
        selectPremiumTheme: (themeId) =>
          setState((prev) => {
            if (themeId && !prev.ownedThemes.includes(themeId)) return prev;
            return { ...prev, selectedPremiumTheme: themeId };
          }),
        purchaseDecoration: (decorationId) =>
          setState((prev) =>
            prev.ownedDecorations.includes(decorationId)
              ? prev
              : { ...prev, ownedDecorations: [...prev.ownedDecorations, decorationId] },
          ),
        selectDecoration: (decorationId) =>
          setState((prev) => {
            const isFree = DECORATIONS[decorationId].price === null;
            if (!isFree && !prev.ownedDecorations.includes(decorationId)) return prev;
            return { ...prev, selectedDecoration: decorationId };
          }),
        recordSupport: (amount: string) =>
          setState((prev) => {
            const entry: SupportEntry = { id: String(Date.now()), amount, date: 'Только что' };
            return { ...prev, supportHistory: [entry, ...prev.supportHistory] };
          }),
        setLanguage: (language: Language) => setState((prev) => ({ ...prev, language, languageSelected: true })),
        exportData: () => {
          const { isReady, ...exportable } = state;
          return JSON.stringify({ app: 'CoupleUp', exportedAt: new Date().toISOString(), data: exportable }, null, 2);
        },
        importData: (json: string) => {
          try {
            const parsed = JSON.parse(json);
            const data = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
            if (!data || typeof data !== 'object' || !('points' in data) || !('history' in data)) {
              return false;
            }
            setState((prev) => ({ ...prev, ...data, isReady: true }));
            return true;
          } catch {
            return false;
          }
        },
        resetApp: () => {
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
          setState({ ...initialState, isReady: true });
        },
      },
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppStore = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
};
