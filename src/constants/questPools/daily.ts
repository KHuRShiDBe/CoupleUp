import { QuestPoolItem } from './types';

// Separate content per partner role -- these are recommendation templates,
// not "duties assigned by gender". 15 items each, 5 easy + 5 medium + 5 hard
// (see questEconomy.ts) -- the full pool IS the day's list now, no rotation.
export const MALE_DAILY_POOL: QuestPoolItem[] = [
  { id: 'm_say_love_you', difficulty: 'easy', titleKey: 'm_say_love_you' },
  { id: 'm_compliment', difficulty: 'easy', titleKey: 'm_compliment' },
  { id: 'm_good_morning', difficulty: 'easy', titleKey: 'm_good_morning' },
  { id: 'm_thanks', difficulty: 'easy', titleKey: 'm_thanks' },
  { id: 'm_hug', difficulty: 'easy', titleKey: 'm_hug' },

  { id: 'm_kiss', difficulty: 'medium', titleKey: 'm_kiss' },
  { id: 'm_work_message', difficulty: 'medium', titleKey: 'm_work_message' },
  { id: 'm_hold_hands', difficulty: 'medium', titleKey: 'm_hold_hands' },
  { id: 'm_ask_about_day', difficulty: 'medium', titleKey: 'm_ask_about_day' },
  { id: 'm_make_drink', difficulty: 'medium', titleKey: 'm_make_drink' },

  { id: 'm_help_chores', difficulty: 'hard', titleKey: 'm_help_chores' },
  { id: 'm_cook_snack', difficulty: 'hard', titleKey: 'm_cook_snack' },
  { id: 'm_no_phone_10min', difficulty: 'hard', titleKey: 'm_no_phone_10min' },
  { id: 'm_small_surprise', difficulty: 'hard', titleKey: 'm_small_surprise' },
  { id: 'm_shoulder_massage', difficulty: 'hard', titleKey: 'm_shoulder_massage' },
];

export const FEMALE_DAILY_POOL: QuestPoolItem[] = [
  { id: 'f_warm_words', difficulty: 'easy', titleKey: 'f_warm_words' },
  { id: 'f_compliment', difficulty: 'easy', titleKey: 'f_compliment' },
  { id: 'f_good_morning', difficulty: 'easy', titleKey: 'f_good_morning' },
  { id: 'f_thanks', difficulty: 'easy', titleKey: 'f_thanks' },
  { id: 'f_hug', difficulty: 'easy', titleKey: 'f_hug' },

  { id: 'f_kiss', difficulty: 'medium', titleKey: 'f_kiss' },
  { id: 'f_day_message', difficulty: 'medium', titleKey: 'f_day_message' },
  { id: 'f_hold_hands', difficulty: 'medium', titleKey: 'f_hold_hands' },
  { id: 'f_ask_about_day', difficulty: 'medium', titleKey: 'f_ask_about_day' },
  { id: 'f_make_drink', difficulty: 'medium', titleKey: 'f_make_drink' },

  { id: 'f_help_task', difficulty: 'hard', titleKey: 'f_help_task' },
  { id: 'f_cook_snack', difficulty: 'hard', titleKey: 'f_cook_snack' },
  { id: 'f_no_phone_10min', difficulty: 'hard', titleKey: 'f_no_phone_10min' },
  { id: 'f_small_surprise', difficulty: 'hard', titleKey: 'f_small_surprise' },
  { id: 'f_hand_massage', difficulty: 'hard', titleKey: 'f_hand_massage' },
];
