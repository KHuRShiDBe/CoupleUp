import { QuestPoolItem } from './types';

// Separate content per partner role -- recommendation templates, not
// "duties assigned by gender". 10 items each: 3 easy + 3 medium + 3 hard +
// 1 very hard (see questEconomy.ts). The two lists differ in wording and
// content but match tier for tier in effort (e.g. cooking dinner for two ~
// organising a cosy evening; a small gift ~ a small gift/treat).
export const MALE_DAILY_POOL: QuestPoolItem[] = [
  { id: 'dm_morning', difficulty: 'easy', titleKey: 'dm_morning' },
  { id: 'dm_thanks', difficulty: 'easy', titleKey: 'dm_thanks' },
  { id: 'dm_compliment', difficulty: 'easy', titleKey: 'dm_compliment' },

  { id: 'dm_drink', difficulty: 'medium', titleKey: 'dm_drink' },
  { id: 'dm_listen', difficulty: 'medium', titleKey: 'dm_listen' },
  { id: 'dm_plan', difficulty: 'medium', titleKey: 'dm_plan' },

  { id: 'dm_chore', difficulty: 'hard', titleKey: 'dm_chore' },
  { id: 'dm_massage', difficulty: 'hard', titleKey: 'dm_massage' },
  { id: 'dm_gift', difficulty: 'hard', titleKey: 'dm_gift' },

  { id: 'dm_dinner', difficulty: 'veryHard', titleKey: 'dm_dinner' },
];

export const FEMALE_DAILY_POOL: QuestPoolItem[] = [
  { id: 'df_morning', difficulty: 'easy', titleKey: 'df_morning' },
  { id: 'df_proud', difficulty: 'easy', titleKey: 'df_proud' },
  { id: 'df_hug', difficulty: 'easy', titleKey: 'df_hug' },

  { id: 'df_snack', difficulty: 'medium', titleKey: 'df_snack' },
  { id: 'df_listen', difficulty: 'medium', titleKey: 'df_listen' },
  { id: 'df_date_idea', difficulty: 'medium', titleKey: 'df_date_idea' },

  { id: 'df_errand', difficulty: 'hard', titleKey: 'df_errand' },
  { id: 'df_massage', difficulty: 'hard', titleKey: 'df_massage' },
  { id: 'df_gift', difficulty: 'hard', titleKey: 'df_gift' },

  { id: 'df_evening', difficulty: 'veryHard', titleKey: 'df_evening' },
];
