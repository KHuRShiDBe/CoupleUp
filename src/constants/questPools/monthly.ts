import { QuestPoolItem } from './types';

// 10 items per role, written to the PERSON WHO DOES THEM (male pool = his
// tasks for her, female pool = her tasks for him): 3 easy + 3 medium +
// 3 hard + 1 very hard, matched tier for tier in effort.
export const MALE_MONTHLY_POOL: QuestPoolItem[] = [
  { id: 'mm_letter', difficulty: 'easy', titleKey: 'mm_letter' },
  { id: 'mm_flowers', difficulty: 'easy', titleKey: 'mm_flowers' },
  { id: 'mm_memory', difficulty: 'easy', titleKey: 'mm_memory' },
  { id: 'mm_cafe', difficulty: 'medium', titleKey: 'mm_cafe' },
  { id: 'mm_album', difficulty: 'medium', titleKey: 'mm_album' },
  { id: 'mm_skill', difficulty: 'medium', titleKey: 'mm_skill' },
  { id: 'mm_day_off', difficulty: 'hard', titleKey: 'mm_day_off' },
  { id: 'mm_fix', difficulty: 'hard', titleKey: 'mm_fix' },
  { id: 'mm_thoughtful_gift', difficulty: 'hard', titleKey: 'mm_thoughtful_gift' },
  { id: 'mm_trip', difficulty: 'veryHard', titleKey: 'mm_trip' },
];

export const FEMALE_MONTHLY_POOL: QuestPoolItem[] = [
  { id: 'mf_letter', difficulty: 'easy', titleKey: 'mf_letter' },
  { id: 'mf_treat', difficulty: 'easy', titleKey: 'mf_treat' },
  { id: 'mf_plans', difficulty: 'easy', titleKey: 'mf_plans' },
  { id: 'mf_cafe', difficulty: 'medium', titleKey: 'mf_cafe' },
  { id: 'mf_video', difficulty: 'medium', titleKey: 'mf_video' },
  { id: 'mf_hobby', difficulty: 'medium', titleKey: 'mf_hobby' },
  { id: 'mf_day_off', difficulty: 'hard', titleKey: 'mf_day_off' },
  { id: 'mf_feast', difficulty: 'hard', titleKey: 'mf_feast' },
  { id: 'mf_gift', difficulty: 'hard', titleKey: 'mf_gift' },
  { id: 'mf_adventure', difficulty: 'veryHard', titleKey: 'mf_adventure' },
];
