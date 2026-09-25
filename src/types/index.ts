import { Language } from '../localization';

export type Role = 'male' | 'female';

export type IconName =
  | 'home'
  | 'history'
  | 'add'
  | 'rewards'
  | 'profile'
  | 'settings'
  | 'notification'
  | 'message'
  | 'tasks'
  | 'achievement'
  | 'back'
  | 'pair'
  | 'goal'
  | 'shop'
  | 'lock'
  | 'periodDaily'
  | 'periodWeekly'
  | 'periodMonthly'
  | 'periodYearly';

export interface ActionHistoryItem {
  id: string;
  title: string;
  points: number;
  date: string;
  authorRole: Role;
  // Optional overrides used when this item is mapped from a real Supabase
  // action (see src/utils/actionDisplay.ts) -- absent for the still-local
  // mock producers (tasks/rewards/penalties), which keep their old rendering
  // (ActionListItem falls back to its previous role-based avatar guess).
  avatarId?: number | null;
  // "Author -> recipient" label (e.g. "Бек -> Рисола"), shown only when the
  // action credited someone other than whoever logged it.
  arrowLabel?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: IconName;
}

export type RewardRequestStatus = 'pending' | 'accepted' | 'declined';
export type RewardRequestKind = 'catalog' | 'custom' | 'gift';

export interface RewardRequest {
  id: string;
  rewardId: string;
  title: string;
  description?: string;
  cost: number;
  message: string;
  date: string;
  // Real ISO timestamp (unlike `date`, which is a display string) --
  // needed for month-based aggregation (Monthly Summary).
  createdAt: string;
  status: RewardRequestStatus;
  kind?: RewardRequestKind;
  // Snapshot of the BOND economy at the moment this request was created, so
  // its price stays fixed even if the rate changes later -- old requests are
  // never recalculated.
  rateSnapshot?: number;
  dollarAmount?: number;
  bondAmount?: number;
}

export type WishlistPriority = 'low' | 'medium' | 'high';

export interface WishlistItem {
  id: string;
  title: string;
  priceUsd: number;
  priority: WishlistPriority;
  createdAt: string;
}

export type TaskAssignee = 'me' | 'partner' | 'both';
export type TaskStatus = 'active' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  createdBy: Role;
  assignee: TaskAssignee;
  status: TaskStatus;
  // Real ISO timestamp, set when the task is completed -- needed for
  // week/month-based aggregation (Weekly/Monthly Summary).
  completedAt?: string;
}

export type PenaltyStatus = 'pending' | 'confirmed' | 'rejected';

export interface Penalty {
  id: string;
  title: string;
  points: number;
  targetRole: Role;
  status: PenaltyStatus;
  date: string;
}

export interface SharedGoal {
  id: string;
  title: string;
  icon: IconName;
  targetPoints: number;
  currentPoints: number;
  // Set once, the first time currentPoints reaches targetPoints -- used to
  // count "goals closed this month" (Monthly Summary).
  completedAt?: string;
}

export interface Achievement {
  id: string;
  title: string;
  unlocked: boolean;
  current: number;
  target: number;
}

export interface NotificationPreferences {
  actions: boolean;
  rewardRequests: boolean;
  penalties: boolean;
  tasks: boolean;
  goals: boolean;
  achievements: boolean;
}

export interface GameHistoryEntry {
  id: string;
  game: string;
  date: string;
  result: string;
  points: number;
  correctAnswers?: number;
}

export interface DailyQuestionAnswer {
  date: string;
  answer: string;
}

export interface CoupleLevelInfo {
  level: number;
  currentPoints: number;
  currentThreshold: number;
  nextThreshold: number | null;
  progress: number;
  remaining: number;
}

export interface SupportEntry {
  id: string;
  amount: string;
  date: string;
}

export type PremiumThemeId = 'lavender' | 'sunset' | 'ocean' | 'rose-gold' | 'midnight' | 'mint';
export type DecorationId = 'classic' | 'hearts' | 'stars' | 'minimal' | 'anniversary';

export interface AppState {
  isReady: boolean;
  onboardingComplete: boolean;
  selectedRole: Role | null;
  selectedAvatar: number | null;
  userName: string;
  points: number;
  earnedPoints: number;
  spentPoints: number;
  lastAction: ActionHistoryItem | null;
  history: ActionHistoryItem[];
  rewardRequests: RewardRequest[];
  tasks: Task[];
  completedTasks: Task[];
  penalties: Penalty[];
  sharedGoals: SharedGoal[];
  wishlist: WishlistItem[];
  coupleStreak: number;
  bestCoupleStreak: number;
  lastActivityDate: string | null;
  notificationPreferences: NotificationPreferences;
  gameHistory: GameHistoryEntry[];
  dailyQuestionAnswer: DailyQuestionAnswer | null;
  questionAnsweredDays: number;
  dailyRewardDate: string | null;
  dailyChallengeStreak: number;
  lastGameRewardDate: string | null;
  ownedThemes: PremiumThemeId[];
  selectedPremiumTheme: PremiumThemeId | null;
  ownedDecorations: DecorationId[];
  selectedDecoration: DecorationId;
  supportHistory: SupportEntry[];
  language: Language;
  languageSelected: boolean;
}

export interface AppActions {
  setRole: (role: Role) => void;
  setAvatar: (avatarId: number) => void;
  setUserName: (name: string) => void;
  completeOnboarding: () => void;
  addAction: (title: string, points: number, authorRole?: Role) => void;
  requestReward: (reward: { id: string; title: string; cost: number }, message: string, rateSnapshot?: number) => void;
  // Custom or gift request -- cost/BOND/$ are computed by the caller from the
  // current rate at creation time and stored as-is (see RewardRequest).
  createCustomRequest: (input: {
    title: string;
    description: string;
    message: string;
    kind: 'custom' | 'gift';
    dollarAmount: number;
    bondAmount: number;
    requiredPoints: number;
    rateSnapshot: number;
  }) => void;
  addWishlistItem: (input: { title: string; priceUsd: number; priority: WishlistPriority }) => void;
  removeWishlistItem: (id: string) => void;
  respondRewardRequest: (requestId: string, accept: boolean) => void;
  completeTask: (taskId: string) => void;
  createTask: (input: { title: string; description: string; points: number; assignee: TaskAssignee }) => void;
  respondTaskRequest: (taskId: string, accept: boolean) => void;
  createPenalty: (input: { title: string; points: number }) => void;
  respondPenalty: (penaltyId: string, accept: boolean) => void;
  addToGoal: (goalId: string, amount: number) => void;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  recordGameResult: (game: string, result: string, points: number, correctAnswers?: number) => void;
  answerDailyQuestion: (answer: string) => void;
  completeDailyChallenge: () => void;
  purchasePremiumTheme: (themeId: PremiumThemeId) => void;
  selectPremiumTheme: (themeId: PremiumThemeId | null) => void;
  purchaseDecoration: (decorationId: DecorationId) => void;
  selectDecoration: (decorationId: DecorationId) => void;
  recordSupport: (amount: string) => void;
  setLanguage: (language: Language) => void;
  exportData: () => string;
  importData: (json: string) => boolean;
  resetApp: () => void;
}

export type AppContextValue = AppState & {
  actions: AppActions;
  achievements: Achievement[];
  pendingRequestsCount: number;
  dailyQuestion: string;
  dailyChallenge: string;
  dailyChallengeCompleted: boolean;
  coupleLevel: CoupleLevelInfo;
};
