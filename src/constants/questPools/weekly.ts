import { QuestPoolItem } from './types';

// 15 items each, 5 easy + 5 medium + 5 hard (see questEconomy.ts) -- the
// full pool IS the week's list now, no rotation.
export const MALE_WEEKLY_POOL: QuestPoolItem[] = [
  { id: 'mw_organize_walk', difficulty: 'easy', titleKey: 'mw_organize_walk' },
  { id: 'mw_phone_free_evening', difficulty: 'easy', titleKey: 'mw_phone_free_evening' },
  { id: 'mw_try_new', difficulty: 'easy', titleKey: 'mw_try_new' },
  { id: 'mw_love_letter', difficulty: 'easy', titleKey: 'mw_love_letter' },
  { id: 'mw_compliment_week', difficulty: 'easy', titleKey: 'mw_compliment_week' },

  { id: 'mw_help_cleaning', difficulty: 'medium', titleKey: 'mw_help_cleaning' },
  { id: 'mw_cook_or_order_dinner', difficulty: 'medium', titleKey: 'mw_cook_or_order_dinner' },
  { id: 'mw_romantic_surprise', difficulty: 'medium', titleKey: 'mw_romantic_surprise' },
  { id: 'mw_plan_weekend', difficulty: 'medium', titleKey: 'mw_plan_weekend' },
  { id: 'mw_no_screens_morning', difficulty: 'medium', titleKey: 'mw_no_screens_morning' },

  { id: 'mw_massage', difficulty: 'hard', titleKey: 'mw_massage' },
  { id: 'mw_fulfill_wish', difficulty: 'hard', titleKey: 'mw_fulfill_wish' },
  { id: 'mw_date_night', difficulty: 'hard', titleKey: 'mw_date_night' },
  { id: 'mw_help_big_task', difficulty: 'hard', titleKey: 'mw_help_big_task' },
  { id: 'mw_small_gift', difficulty: 'hard', titleKey: 'mw_small_gift' },
];

export const FEMALE_WEEKLY_POOL: QuestPoolItem[] = [
  { id: 'fw_organize_walk', difficulty: 'easy', titleKey: 'fw_organize_walk' },
  { id: 'fw_propose_evening', difficulty: 'easy', titleKey: 'fw_propose_evening' },
  { id: 'fw_try_new', difficulty: 'easy', titleKey: 'fw_try_new' },
  { id: 'fw_love_note', difficulty: 'easy', titleKey: 'fw_love_note' },
  { id: 'fw_compliment_week', difficulty: 'easy', titleKey: 'fw_compliment_week' },

  { id: 'fw_help_delayed_task', difficulty: 'medium', titleKey: 'fw_help_delayed_task' },
  { id: 'fw_cook_favorite_dish', difficulty: 'medium', titleKey: 'fw_cook_favorite_dish' },
  { id: 'fw_cozy_evening', difficulty: 'medium', titleKey: 'fw_cozy_evening' },
  { id: 'fw_plan_weekend', difficulty: 'medium', titleKey: 'fw_plan_weekend' },
  { id: 'fw_no_screens_morning', difficulty: 'medium', titleKey: 'fw_no_screens_morning' },

  { id: 'fw_head_body_massage', difficulty: 'hard', titleKey: 'fw_head_body_massage' },
  { id: 'fw_fulfill_wish', difficulty: 'hard', titleKey: 'fw_fulfill_wish' },
  { id: 'fw_date_night', difficulty: 'hard', titleKey: 'fw_date_night' },
  { id: 'fw_help_big_task', difficulty: 'hard', titleKey: 'fw_help_big_task' },
  { id: 'fw_small_gift', difficulty: 'hard', titleKey: 'fw_small_gift' },
];
