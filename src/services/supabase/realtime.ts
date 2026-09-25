import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { DbCouple, DbNotification, DbReminder } from '../../types/database';

// Couple-shared wishlist (migration 0017) -- both partners stay in sync.
export const subscribeToWishlist = (coupleId: string, onChange: () => void): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`wishlist-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wishlist_items', filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface CoupleRealtimeHandlers {
  onCoupleChange?: (couple: DbCouple) => void;
  // Fires when a member joins/leaves the couple (e.g. the partner completing
  // join_couple_by_code) -- this is how the side that CREATED the code finds
  // out a partner connected, since that side never calls joinCoupleByCode
  // itself.
  onMembersChange?: () => void;
  onActionsChange?: () => void;
  onTasksChange?: () => void;
  onRewardRequestsChange?: () => void;
  onGoalsChange?: () => void;
  onPenaltiesChange?: () => void;
}

// Single entry point for every table the app keeps live-synced for one couple:
// points/actions/tasks/reward_requests/goals/penalties. Returns an unsubscribe
// function; a no-op when the backend isn't configured yet.
export const subscribeToCouple = (coupleId: string, handlers: CoupleRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`couple-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` },
      (payload) => {
        if (payload.new && handlers.onCoupleChange) handlers.onCoupleChange(payload.new as DbCouple);
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_members', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onMembersChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'actions', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onActionsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onTasksChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reward_requests', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onRewardRequestsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'goals', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onGoalsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'penalties', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onPenaltiesChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface CoupleInteractionRealtimeHandlers {
  onMoodChange?: () => void;
  onAnswerChange?: () => void;
  onMomentsChange?: () => void;
  onImportantDatesChange?: () => void;
}

// Separate channel from subscribeToCouple -- these tables (check-ins, daily
// answers, moments, important dates) are a distinct "engagement" domain from
// the points/actions ledger, so they get their own context/subscription
// rather than growing the couple-sync one further.
export const subscribeToCoupleInteraction = (
  coupleId: string,
  handlers: CoupleInteractionRealtimeHandlers,
): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`couple-interaction-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mood_checkins', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onMoodChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_answers', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onAnswerChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_moments', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onMomentsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'important_dates', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onImportantDatesChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface PlanningRealtimeHandlers {
  onHabitsChange?: () => void;
  onHabitLogsChange?: () => void;
  onPromisesChange?: () => void;
  onDateIdeaSavesChange?: () => void;
  onWantsChange?: () => void;
  onPlanItemsChange?: () => void;
}

// habits/promises/saved date ideas/wants/plan board -- couple-shared, so
// realtime keeps both phones in sync. surprise_ideas is deliberately absent
// here: it's single-user private data (see migration 0011) and must never
// broadcast to the partner.
export const subscribeToPlanning = (coupleId: string, handlers: PlanningRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`planning-${coupleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `couple_id=eq.${coupleId}` }, () =>
      handlers.onHabitsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habit_logs', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onHabitLogsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'promises', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onPromisesChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'date_idea_saves', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onDateIdeaSavesChange?.(),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wants', filter: `couple_id=eq.${coupleId}` }, () =>
      handlers.onWantsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'plan_items', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onPlanItemsChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface BudgetRealtimeHandlers {
  onShoppingItemsChange?: () => void;
  onBudgetsChange?: () => void;
  onExpensesChange?: () => void;
  onSavingsGoalsChange?: () => void;
  onSavingsContributionsChange?: () => void;
  onPurchaseRequestsChange?: () => void;
  onPurchaseRequestOffersChange?: () => void;
}

// Shopping list, budget, expenses, savings goals/contributions, purchase
// requests -- all couple-shared, so both phones stay in sync.
export const subscribeToBudget = (coupleId: string, handlers: BudgetRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`budget-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shopping_items', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onShoppingItemsChange?.(),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `couple_id=eq.${coupleId}` }, () =>
      handlers.onBudgetsChange?.(),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `couple_id=eq.${coupleId}` }, () =>
      handlers.onExpensesChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'savings_goals', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onSavingsGoalsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'savings_contributions', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onSavingsContributionsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'purchase_requests', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onPurchaseRequestsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'purchase_request_offers', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onPurchaseRequestOffersChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface ProgressionRealtimeHandlers {
  onChallengeProgressChange?: () => void;
  onDailyChallengeChange?: () => void;
  onAchievementUnlocksChange?: () => void;
  onRewardClaimsChange?: () => void;
  onQuizAnswersChange?: () => void;
}

// Weekly/daily challenges, achievements, reward chest claims, couple quiz --
// all couple-shared, so both phones stay in sync.
export const subscribeToProgression = (coupleId: string, handlers: ProgressionRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`progression-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'challenge_progress', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onChallengeProgressChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_challenges', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onDailyChallengeChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'achievement_unlocks', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onAchievementUnlocksChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reward_claims', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onRewardClaimsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quiz_answers', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onQuizAnswersChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Notifications are scoped to one user (not one couple), so they get their
// own subscription filtered on recipient_id rather than couple_id.
export const subscribeToNotifications = (userId: string, onInsert: (row: DbNotification) => void): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
      (payload) => onInsert(payload.new as DbNotification),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface GamesRealtimeHandlers {
  onPartnerQuizAnswersChange?: () => void;
  onEitherOrChoicesChange?: () => void;
  onTruthOrDareProgressChange?: () => void;
  onGameRewardClaimsChange?: () => void;
}

// PartnerQuiz/EitherOr/TruthOrDare -- couple-shared, both phones stay in sync.
export const subscribeToGames = (coupleId: string, handlers: GamesRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`games-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partner_quiz_answers', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onPartnerQuizAnswersChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'either_or_choices', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onEitherOrChoicesChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'truth_or_dare_progress', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onTruthOrDareProgressChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_reward_claims', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onGameRewardClaimsChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface DailyActionsRealtimeHandlers {
  onCompletionsChange?: () => void;
  onProgressChange?: () => void;
}

// Daily Required Actions/Bonus/Wheel (migration 0019) -- couple-shared.
export const subscribeToDailyActions = (coupleId: string, handlers: DailyActionsRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`daily-actions-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_action_completions', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onCompletionsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_progress', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onProgressChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Reminders are personal (scoped to one user, not one couple) -- this keeps
// the same user's other signed-in device in sync, same shape as notifications.
export const subscribeToReminders = (userId: string, onChange: () => void): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`reminders-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface QuestsRealtimeHandlers {
  onProgressChange?: () => void;
  onBonusClaimsChange?: () => void;
  onCustomItemsChange?: () => void;
  onHiddenItemsChange?: () => void;
}

// Daily/weekly/monthly/yearly quest completions + milestone bonus claims +
// pending custom items (migration 0021) -- couple-shared.
export const subscribeToQuests = (coupleId: string, handlers: QuestsRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`quests-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quest_progress', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onProgressChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quest_bonus_claims', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onBonusClaimsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quest_custom_items', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onCustomItemsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quest_hidden_items', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onHiddenItemsChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface IntimateRouletteRealtimeHandlers {
  onConsentChange?: () => void;
  onSettingsChange?: () => void;
  onResultsChange?: () => void;
  // wish_inventory (migration 0031) is also where intimate-roulette coupons
  // live -- won on the OTHER wheel (WishRoulette), so this screen needs its
  // own listener to notice a freshly-won coupon without a manual refresh.
  onCouponsChange?: () => void;
}

// Consent, allowed-category settings, and spin history (migration 0022) --
// couple-shared.
export const subscribeToIntimateRoulette = (coupleId: string, handlers: IntimateRouletteRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`intimate-roulette-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'intimate_roulette_consent', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onConsentChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'intimate_roulette_settings', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onSettingsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'intimate_roulette_results', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onResultsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wish_inventory', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onCouponsChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface WishRouletteRealtimeHandlers {
  onResultsChange?: () => void;
}

// Paid gendered wish roulette (migration 0024) -- couple-shared results feed.
export const subscribeToWishRoulette = (coupleId: string, handlers: WishRouletteRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`wish-roulette-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wish_roulette_results', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onResultsChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface ShopRouletteRealtimeHandlers {
  onResultsChange?: () => void;
  // wish_inventory (migration 0031) is also where the coupon this wheel can
  // spend lives -- won on the main wish roulette, so this needs its own
  // listener to notice a freshly-won coupon without a manual refresh.
  onCouponsChange?: () => void;
}

// Female-only Shop Roulette (migration 0032) -- couple-shared results feed.
export const subscribeToShopRoulette = (coupleId: string, handlers: ShopRouletteRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`shop-roulette-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shop_roulette_results', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onResultsChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wish_inventory', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onCouponsChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// "Мои накопления" -- one user's own wish_inventory rows (roulette
// winnings + coupons). Filtered by owner_id, not couple_id, so a change to
// the partner's winnings never triggers a refetch here.
export const subscribeToSavings = (userId: string, onChange: () => void): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`savings-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wish_inventory', filter: `owner_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export interface CoupleOffersRealtimeHandlers {
  onOffersChange?: () => void;
  onCountersChange?: () => void;
}

// Partner-to-partner priced proposals + counter-offer negotiation
// (migration 0021) -- couple-shared.
export const subscribeToCoupleOffers = (coupleId: string, handlers: CoupleOffersRealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`couple-offers-${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_offers', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onOffersChange?.(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_offer_counters', filter: `couple_id=eq.${coupleId}` },
      () => handlers.onCountersChange?.(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
