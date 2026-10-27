// Hand-written mirrors of the Supabase schema in supabase/migrations/*.sql.
import { Role, TaskAssignee, WishlistPriority } from './index';
import { Language } from '../localization';

// Maps to the `public.profiles` table (renamed from `users` in migration 0002).
export interface DbUser {
  id: string;
  name: string;
  role: Role | null;
  selected_avatar: number | null;
  photo_url: string | null;
  theme: Role | null;
  language: Language;
  notification_preferences: DbNotificationPreferences;
  push_enabled: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  created_at: string;
}

// Mirrors src/types/index.ts NotificationPreferences -- kept as a separate
// type here since it lives in a jsonb column, not typed columns.
export interface DbNotificationPreferences {
  actions: boolean;
  rewardRequests: boolean;
  penalties: boolean;
  tasks: boolean;
  goals: boolean;
  achievements: boolean;
}

export interface DbCouple {
  id: string;
  code: string;
  code_expires_at: string;
  created_by: string;
  points: number;
  earned_points: number;
  spent_points: number;
  couple_streak: number;
  best_couple_streak: number;
  last_activity_date: string | null;
  created_at: string;
}

export interface DbCoupleMember {
  couple_id: string;
  user_id: string;
  joined_at: string;
}

export type DbActionType = 'action' | 'task' | 'reward' | 'penalty' | 'goal' | 'compliment';

export interface DbAction {
  id: string;
  couple_id: string;
  author_id: string;
  recipient_id: string;
  title: string;
  points: number;
  type: DbActionType;
  created_at: string;
}

export interface DbReward {
  id: string;
  couple_id: string;
  title: string;
  description: string | null;
  cost: number;
  category: string | null;
  created_at: string;
}

export type DbRewardRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface DbRewardRequest {
  id: string;
  couple_id: string;
  reward_id: string | null;
  requested_by: string;
  title: string;
  cost: number;
  message: string | null;
  status: DbRewardRequestStatus;
  created_at: string;
  resolved_at: string | null;
}

export type DbTaskStatus = 'active' | 'completed';

export interface DbTask {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  description: string | null;
  points: number;
  assignee: TaskAssignee;
  status: DbTaskStatus;
  created_at: string;
  completed_at: string | null;
}

export interface DbGoal {
  id: string;
  couple_id: string;
  title: string;
  icon: string | null;
  target_points: number;
  current_points: number;
  created_at: string;
}

export type DbPenaltyStatus = 'pending' | 'confirmed' | 'rejected';

export interface DbPenalty {
  id: string;
  couple_id: string;
  created_by: string;
  target_user_id: string;
  title: string;
  points: number;
  status: DbPenaltyStatus;
  created_at: string;
  resolved_at: string | null;
}

// A quick "I did this" / "they did this for me" entry (AddActionScreen's
// "quick" tab, migration 0037) -- pending until reviewer_user_id (always the
// OTHER couple member, server-derived, regardless of who recipient_id
// credits) approves or rejects it. Only on approval does a row land in
// `actions`, which is what actually credits the balance (existing trigger,
// unchanged).
export type DbActionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface DbActionRequest {
  id: string;
  couple_id: string;
  actor_user_id: string;
  reviewer_user_id: string;
  recipient_id: string;
  title: string;
  points: number;
  status: DbActionRequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  // Set only for quest-originated requests (complete_quest_item, migration
  // 0041) -- null for AddActionScreen's "quick" tab. Lets respond_action_request
  // know which quest_progress row to create on approval, and lets the client
  // show "Ждёт подтверждения" on the matching quest item while pending.
  period: QuestPeriod | null;
  period_key: string | null;
  item_key: string | null;
  // Set only for bonus-claim requests (claim_quest_bonus, migration 0043) --
  // null for quest items and AddActionScreen's "quick" tab. Lets
  // respond_action_request know to write quest_bonus_claims on approval.
  bonus_milestone: number | null;
  created_at: string;
}

// Global points-per-BOND exchange rate -- not couple-scoped, see migration
// 0008. BOND is a display/denomination layer over points, not a new balance.
export interface DbBondRate {
  id: string;
  points_per_bond: number;
  effective_from: string;
  created_at: string;
  is_holiday: boolean;
}

export type MoodValue = 'great' | 'good' | 'okay' | 'tired' | 'low';

// One row per user, period -- no date/history (migration 0039). user_id is
// the primary key, so there is never more than one row per person.
export interface DbUserMood {
  user_id: string;
  couple_id: string;
  mood: MoodValue;
  updated_at: string;
}

export interface DbDailyAnswer {
  id: string;
  couple_id: string;
  user_id: string;
  question_date: string;
  answer: string;
  created_at: string;
}

export interface DbCoupleMoment {
  id: string;
  couple_id: string;
  author_id: string;
  title: string;
  description: string | null;
  moment_date: string;
  created_at: string;
}

export type ImportantDateType = 'anniversary' | 'met_day' | 'wedding_day' | 'partner_birthday' | 'custom';

export interface DbImportantDate {
  id: string;
  couple_id: string;
  created_by: string;
  type: ImportantDateType;
  label: string;
  date: string;
  created_at: string;
}

export type HabitFrequency = 'daily' | 'weekly';

export interface DbHabit {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  assignee: TaskAssignee;
  created_at: string;
}

export interface DbHabitLog {
  id: string;
  habit_id: string;
  couple_id: string;
  user_id: string;
  log_date: string;
  created_at: string;
}

export type PromiseStatus = 'active' | 'completed' | 'cancelled';

export interface DbPromise {
  id: string;
  couple_id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  status: PromiseStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface DbDateIdeaSave {
  id: string;
  couple_id: string;
  idea_key: string | null;
  title: string;
  category: string;
  price_usd: number | null;
  created_by: string;
  created_at: string;
}

export type WantKind = 'want' | 'dont_want';

export interface DbWant {
  id: string;
  couple_id: string;
  user_id: string;
  kind: WantKind;
  text: string;
  created_at: string;
}

export type SurprisePriority = 'low' | 'medium' | 'high';

export interface DbSurpriseIdea {
  id: string;
  couple_id: string;
  author_id: string;
  title: string;
  note: string | null;
  price_usd: number | null;
  priority: SurprisePriority;
  created_at: string;
}

export type PlanItemKind = 'date' | 'task' | 'goal' | 'purchase' | 'trip' | 'event';
export type PlanBucket = 'today' | 'week' | 'month' | 'someday';

export interface DbPlanItem {
  id: string;
  couple_id: string;
  created_by: string;
  kind: PlanItemKind;
  title: string;
  bucket: PlanBucket;
  done: boolean;
  created_at: string;
}

export type BudgetCategory = 'food' | 'home' | 'fun' | 'transport' | 'gifts' | 'travel' | 'other';
export type PayerMode = 'assigned' | 'together' | 'undetermined';

export interface DbShoppingItem {
  id: string;
  couple_id: string;
  title: string;
  quantity: number;
  price_usd: number | null;
  added_by: string;
  payer_mode: PayerMode;
  payer_user_id: string | null;
  purchased: boolean;
  created_at: string;
}

export interface DbBudget {
  id: string;
  couple_id: string;
  category: BudgetCategory;
  month: string;
  planned_usd: number;
  created_by: string;
  created_at: string;
}

export interface DbExpense {
  id: string;
  couple_id: string;
  title: string;
  amount_usd: number;
  category: BudgetCategory;
  paid_by: string;
  expense_date: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface DbSavingsGoal {
  id: string;
  couple_id: string;
  title: string;
  target_usd: number;
  created_by: string;
  created_at: string;
}

export interface DbSavingsContribution {
  id: string;
  goal_id: string;
  couple_id: string;
  user_id: string;
  amount_usd: number;
  created_at: string;
}

export type PurchaseRequestStatus = 'pending' | 'approved' | 'declined';

export type PurchaseRequestOfferStatus = 'pending' | 'accepted' | 'declined' | 'superseded';

export interface DbPurchaseRequestOffer {
  id: string;
  couple_id: string;
  purchase_request_id: string;
  proposed_by: string | null;
  price_usd: number;
  note: string | null;
  status: PurchaseRequestOfferStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface DbPurchaseRequest {
  id: string;
  couple_id: string;
  requested_by: string;
  recipient_id: string;
  title: string;
  price_usd: number;
  rate_snapshot: number;
  note: string | null;
  status: PurchaseRequestStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface DbChallengeProgress {
  id: string;
  couple_id: string;
  week_key: string;
  challenge_key: string;
  completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  created_at: string;
}

export interface DbDailyChallenge {
  id: string;
  couple_id: string;
  challenge_date: string;
  completed_by: string;
  completed_at: string;
}

export interface DbAchievementUnlock {
  id: string;
  couple_id: string;
  achievement_key: string;
  unlocked_at: string;
}

export interface DbRewardClaim {
  id: string;
  couple_id: string;
  milestone_key: string;
  points_awarded: number;
  claimed_by: string;
  claimed_at: string;
}

export interface DbQuizAnswer {
  id: string;
  couple_id: string;
  user_id: string;
  question_key: string;
  answer: string;
  created_at: string;
}

export type DbDeviceTokenPlatform = 'ios' | 'android';

export interface DbDeviceToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: DbDeviceTokenPlatform;
  device_id: string;
  updated_at: string;
}

export type DbNotificationType =
  | 'action'
  | 'task'
  | 'task_done'
  | 'reward_request'
  | 'reward_response'
  | 'penalty'
  | 'penalty_response'
  | 'goal'
  | 'compliment'
  | 'promise_completed'
  | 'challenge_completed'
  | 'goal_completed'
  | 'purchase_request'
  | 'purchase_response'
  | 'nudge'
  | 'action_request'
  | 'action_response'
  | 'wish_completion_request'
  | 'wish_completion_response'
  | 'prize_use_request'
  | 'wish_important'
  | 'wish_offer';

export interface DbNotification {
  id: string;
  couple_id: string;
  recipient_id: string;
  type: DbNotificationType;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

// ---- Reminders (migration 0015) -- personal, not couple-shared. ----------

export type ReminderTargetType = 'promise' | 'habit' | 'important_date' | 'goal' | 'task' | 'shopping_item';
export type ReminderRule = 'today' | 'tomorrow' | 'in_3_days' | 'specific_date' | 'weekly';

export interface DbReminder {
  id: string;
  couple_id: string;
  user_id: string;
  target_type: ReminderTargetType;
  target_id: string | null;
  title: string;
  rule: ReminderRule;
  remind_at: string;
  repeat_weekly: boolean;
  is_active: boolean;
  last_fired_at: string | null;
  created_at: string;
}

// ---- Wishlist (migration 0017) -- couple-shared, replaces the legacy
// local-only AppContext wishlist. ------------------------------------------

export interface DbWishlistItem {
  id: string;
  couple_id: string;
  created_by: string | null;
  title: string;
  price_usd: number | null;
  priority: WishlistPriority;
  created_at: string;
  // Added by migration 0045 -- optional so rows from a database without it
  // still type-check; a missing status means 'active'.
  status?: DbWishlistStatus;
  completion_requested_by?: string | null;
  completion_requested_at?: string | null;
  completed_at?: string | null;
  // Migration 0048: 1 (one hour), 24 (one day) or null (no deadline),
  // counted from created_at.
  deadline_hours?: number | null;
  // Migration 0048: "🚨 important" (1 BOND). important_seen_at = the
  // partner pressed OK on the important-wish window (read, not done).
  is_important?: boolean;
  important_at?: string | null;
  important_seen_at?: string | null;
  // Migration 0049: one-time deadline surcharge paid at creation (points).
  deadline_fee_points?: number;
  // Migration 0052: bargaining over the reward (points; 100 = 1 BOND).
  offer_points?: number | null;
  offer_by?: string | null;
  agreed_points?: number | null;
  // 'none' = legacy wish (no payout), 'open' = offer awaiting an answer.
  negotiation_status?: 'none' | 'open' | 'declined' | 'agreed';
  paid_at?: string | null;
  // Credited to the executor so far / still owed (paid later within the
  // 500-point daily cap).
  payout_points?: number | null;
  payout_pending_points?: number;
}

export type DbWishlistStatus = 'active' | 'pending' | 'done';

// ---- Mini-games (migration 0018) -- PartnerQuiz/EitherOr/TruthOrDare move
// off local-only state. Game CONTENT stays static client-side (same pattern
// as date_idea_saves/daily_challenges); only answers/progress/reward claims
// are real rows. -----------------------------------------------------------

export interface DbPartnerQuizAnswer {
  id: string;
  couple_id: string;
  quiz_id: string;
  question_index: number;
  user_id: string;
  selected_index: number;
  created_at: string;
}

export interface DbEitherOrChoice {
  id: string;
  couple_id: string;
  pair_index: number;
  user_id: string;
  choice: string;
  created_at: string;
}

export type TruthOrDareKind = 'truth' | 'dare';

export interface DbTruthOrDareProgress {
  couple_id: string;
  current_round: number;
  current_kind: TruthOrDareKind | null;
  updated_at: string;
}

export interface DbGameRewardClaim {
  id: string;
  couple_id: string;
  game_key: string;
  claimed_at: string;
}

// ---- Daily Required Actions (migration 0019) ------------------------------

export interface DbDailyActionCompletion {
  id: string;
  couple_id: string;
  action_id: string;
  action_date: string;
  completed_by: string | null;
  points: number;
  created_at: string;
}

export interface DbDailyProgress {
  couple_id: string;
  progress_date: string;
  bonus_claimed: boolean;
  wheel_spun: boolean;
  wheel_reward_points: number | null;
  updated_at: string;
}

// ---- Quest system + couple offers (migration 0021) ------------------------

export type QuestPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface DbQuestProgress {
  id: string;
  couple_id: string;
  period: QuestPeriod;
  period_key: string;
  item_key: string;
  title: string;
  points: number;
  completed_by: string | null;
  completed_at: string;
  created_at: string;
}

export interface DbQuestCustomItem {
  id: string;
  couple_id: string;
  period: QuestPeriod;
  period_key: string;
  item_key: string;
  title: string;
  points: number;
  created_by: string | null;
  created_at: string;
  // Set when this custom item fills a hidden standard item's slot (see
  // DbQuestHiddenItem) -- null for a genuine paid "extra" beyond the free 15.
  replaces_item_key: string | null;
}

// A standard quest item this user has permanently hidden (migration 0034) --
// period-scoped, not period_key-scoped, so it stays hidden across every
// future day/week/month/year, not just the current one.
export interface DbQuestHiddenItem {
  id: string;
  couple_id: string;
  user_id: string;
  period: QuestPeriod;
  item_key: string;
  hidden_at: string;
}

export interface DbQuestBonusClaim {
  id: string;
  couple_id: string;
  user_id: string | null;
  period: QuestPeriod;
  period_key: string;
  milestone: number;
  points: number;
  claimed_at: string;
}

export type CoupleOfferStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'failed' | 'cancel_pending' | 'cancelled';

export interface DbCoupleOffer {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  price_points: number;
  status: CoupleOfferStatus;
  deadline: string | null;
  assignee_id: string | null;
  cancel_requested_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type CoupleOfferCounterStatus = 'pending' | 'accepted' | 'declined' | 'superseded';

export interface DbCoupleOfferCounter {
  id: string;
  couple_id: string;
  offer_id: string;
  proposed_by: string | null;
  price_points: number;
  note: string | null;
  status: CoupleOfferCounterStatus;
  created_at: string;
  resolved_at: string | null;
}

// ---- Intimate Roulette (migration 0022) ------------------------------------

export interface DbIntimateRouletteConsent {
  couple_id: string;
  user_id: string;
  consented: boolean;
  updated_at: string;
}

export interface IntimateRouletteAllowed {
  tender: boolean;
  active: boolean;
  dominant: boolean;
  blindfold: boolean;
  bondage: boolean;
  roleplay: boolean;
}

export interface DbIntimateRouletteSettings {
  couple_id: string;
  allowed: IntimateRouletteAllowed;
  updated_at: string;
}

export interface DbIntimateRouletteResult {
  id: string;
  couple_id: string;
  result_key: string;
  spun_by: string | null;
  used_coupon: boolean;
  cost_points: number;
  created_at: string;
}

export interface DbShopRouletteResult {
  id: string;
  couple_id: string;
  spun_by: string | null;
  item_key: string;
  used_coupon: boolean;
  cost_points: number;
  created_at: string;
}

export interface DbChatMessage {
  id: string;
  couple_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  read_at: string | null;
}

export type WishInventoryStatus = 'available' | 'pending_use' | 'used';

export interface DbWishInventoryItem {
  id: string;
  couple_id: string;
  owner_id: string;
  gender: 'male' | 'female';
  item_key: string;
  status: WishInventoryStatus;
  won_at: string;
  requested_at: string | null;
  used_at: string | null;
}

export interface DbWishRouletteResult {
  id: string;
  couple_id: string;
  spun_by: string | null;
  gender: 'male' | 'female';
  item_key: string;
  value_points: number;
  cost_points: number;
  created_at: string;
}

export type ReminderDeliveryStatus = 'pending' | 'delivered' | 'dismissed';

export interface DbReminderDelivery {
  id: string;
  reminder_id: string;
  scheduled_for: string;
  delivered_at: string | null;
  status: ReminderDeliveryStatus;
  created_at: string;
}

// Shared couple board (migration 0050). Coordinates are normalised 0..1.
export type BoardColor = 'red' | 'blue' | 'green';
export type BoardStrokeData = { points: [number, number][] };
export type BoardTextData = { x: number; y: number; text: string };

export interface DbBoardItem {
  id: string;
  couple_id: string;
  author_id: string | null;
  kind: 'stroke' | 'eraser' | 'text';
  color: BoardColor | 'eraser';
  data: BoardStrokeData | BoardTextData;
  created_at: string;
}

export type DbBoardItemInsert = Omit<DbBoardItem, 'id' | 'created_at'>;
