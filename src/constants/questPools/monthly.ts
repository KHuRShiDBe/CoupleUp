import { QuestPoolItem } from './types';

// 15 items each, 5 easy + 5 medium + 5 hard (see questEconomy.ts).
export const MALE_MONTHLY_POOL: QuestPoolItem[] = [
  { id: 'mm_photo_walk', difficulty: 'easy', titleKey: 'mm_photo_walk' },
  { id: 'mm_movie_night', difficulty: 'easy', titleKey: 'mm_movie_night' },
  { id: 'mm_message_of_month', difficulty: 'easy', titleKey: 'mm_message_of_month' },
  { id: 'mm_small_thanks', difficulty: 'easy', titleKey: 'mm_small_thanks' },
  { id: 'mm_joint_hobby', difficulty: 'easy', titleKey: 'mm_joint_hobby' },

  { id: 'mm_full_date', difficulty: 'medium', titleKey: 'mm_full_date' },
  { id: 'mm_cook_together', difficulty: 'medium', titleKey: 'mm_cook_together' },
  { id: 'mm_unusual_evening', difficulty: 'medium', titleKey: 'mm_unusual_evening' },
  { id: 'mm_fulfil_promise', difficulty: 'medium', titleKey: 'mm_fulfil_promise' },
  { id: 'mm_small_project', difficulty: 'medium', titleKey: 'mm_small_project' },

  { id: 'mm_gift', difficulty: 'hard', titleKey: 'mm_gift' },
  { id: 'mm_fulfil_her_wish', difficulty: 'hard', titleKey: 'mm_fulfil_her_wish' },
  { id: 'mm_day_trip', difficulty: 'hard', titleKey: 'mm_day_trip' },
  { id: 'mm_home_upgrade', difficulty: 'hard', titleKey: 'mm_home_upgrade' },
  { id: 'mm_celebrate_progress', difficulty: 'hard', titleKey: 'mm_celebrate_progress' },
];

export const FEMALE_MONTHLY_POOL: QuestPoolItem[] = [
  { id: 'fm_photo_walk', difficulty: 'easy', titleKey: 'fm_photo_walk' },
  { id: 'fm_movie_night', difficulty: 'easy', titleKey: 'fm_movie_night' },
  { id: 'fm_message_of_month', difficulty: 'easy', titleKey: 'fm_message_of_month' },
  { id: 'fm_small_thanks', difficulty: 'easy', titleKey: 'fm_small_thanks' },
  { id: 'fm_new_recipe', difficulty: 'easy', titleKey: 'fm_new_recipe' },

  { id: 'fm_full_date', difficulty: 'medium', titleKey: 'fm_full_date' },
  { id: 'fm_joint_activity', difficulty: 'medium', titleKey: 'fm_joint_activity' },
  { id: 'fm_unusual_evening', difficulty: 'medium', titleKey: 'fm_unusual_evening' },
  { id: 'fm_fulfil_promise', difficulty: 'medium', titleKey: 'fm_fulfil_promise' },
  { id: 'fm_small_project', difficulty: 'medium', titleKey: 'fm_small_project' },

  { id: 'fm_gift', difficulty: 'hard', titleKey: 'fm_gift' },
  { id: 'fm_fulfil_his_wish', difficulty: 'hard', titleKey: 'fm_fulfil_his_wish' },
  { id: 'fm_day_trip', difficulty: 'hard', titleKey: 'fm_day_trip' },
  { id: 'fm_cozy_upgrade', difficulty: 'hard', titleKey: 'fm_cozy_upgrade' },
  { id: 'fm_celebrate_progress', difficulty: 'hard', titleKey: 'fm_celebrate_progress' },
];
