import type { NavigatorScreenParams } from '@react-navigation/native';
import { PremiumThemeId } from '../types';
import { QuestPeriod } from '../types/database';

export type RootStackParamList = {
  Splash: undefined;
  Language: { mode: 'initial' | 'settings' };
  Welcome: undefined;
  RoleSelection: undefined;
  AvatarSelection: undefined;
  Name: undefined;
  ConnectPartner: undefined;
  // Optional nested-tab target -- e.g. navigate('Main', { screen: 'Settings' })
  // from a root-stack screen (Profile, CoupleProfile) to land on a specific
  // tab, since Chat/Settings moved from root-stack screens into tabs.
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Account: undefined;
  Requests: undefined;
  CoupleProfile: undefined;
  Tasks: undefined;
  Penalties: undefined;
  SharedGoals: undefined;
  Achievements: undefined;
  Games: undefined;
  QuestionOfTheDay: undefined;
  PartnerQuiz: { quizId: 'partner-1' | 'partner-2' };
  TruthOrDare: undefined;
  EitherOr: undefined;
  Support: undefined;
  ThemeStore: undefined;
  ThemePreview: { themeId: PremiumThemeId };
  CoupleDecorations: undefined;
  AppIcon: undefined;
  NotificationTest: undefined;
  DeleteAccount: undefined;
  Privacy: undefined;
  DataPermissions: undefined;
  BlockedUsers: undefined;
  ReportUser: { userId: string } | undefined;
  BondRate: undefined;
  BondCollection: undefined;
  Wishlist: { owner?: 'me' | 'partner' } | undefined;
  MonthlySummary: undefined;
  Compliments: undefined;
  Moments: undefined;
  ImportantDates: undefined;
  CoupleStats: undefined;
  WeeklyCoupleSummary: undefined;
  Habits: undefined;
  Promises: undefined;
  DateIdeas: undefined;
  Wants: undefined;
  SurpriseIdeas: undefined;
  PlanBoard: undefined;
  Calendar: undefined;
  ShoppingList: undefined;
  Budget: undefined;
  ExpenseHistory: undefined;
  SavingsGoal: undefined;
  FairSplit: undefined;
  MoneySummary: undefined;
  PurchaseRequests: undefined;
  WeeklyChallenges: undefined;
  DateWheel: undefined;
  CoupleQuiz: undefined;
  CoupleRewardChest: undefined;
  Security: undefined;
  PrivacyCenter: undefined;
  PrivacyData: undefined;
  About: undefined;
  ActivityCenter: undefined;
  Reminders: undefined;
  DailyDigest: undefined;
  WeeklyDigest: undefined;
  DailyTasks: undefined;
  DailyCalendar: undefined;
  Analytics: undefined;
  DailyHub: undefined;
  CoupleModules: undefined;
  MoneyHub: undefined;
  Sections: undefined;
  RouletteHub: undefined;
  IntimateRoulette: undefined;
  // Female-only wheel that replaces IntimateRoulette in the roulette hub for
  // female accounts (see RouletteHubScreen) -- male accounts never see this
  // route. Migration 0032.
  ShopRoulette: undefined;
  CoupleRoulette: undefined;
  // Personal roulette winnings + coupons -- replaces the "Каждую неделю"
  // quick card on Home (see HomeScreen). Own wish_inventory rows only.
  Savings: undefined;
  WishRoulette: undefined;
  Finance: undefined;
  // Was a bottom tab -- still reached from Home's period quick-action cards,
  // now as a regular pushed screen (see RootNavigator).
  Rewards: { period?: QuestPeriod } | undefined;
  // Was a bottom tab -- now reached from Settings ("История"),
  // as a regular pushed screen (see RootNavigator). Profile's own UI was
  // merged directly into SettingsScreen -- no separate route anymore.
  History: undefined;
  // Was a bottom tab ("Договоры") -- now reached from Home's own "Договоры"
  // card, as a regular pushed screen (see RootNavigator).
  // Was a bottom tab -- now reached from Home's own bell button (top-right
  // corner), as a regular pushed screen (see RootNavigator).
  Notifications: undefined;
  // `manual` distinguishes a first-run auto-show (Splash replaces to here,
  // finishing replaces to Main) from a re-open from Settings (finishing just
  // goes back) -- see TutorialScreen.
  Tutorial: { manual?: boolean } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Chat: undefined;
  Settings: undefined;
};
