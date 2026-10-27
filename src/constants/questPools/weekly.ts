import { QuestPoolItem } from './types';

// 10 items per role, written to the PERSON WHO DOES THEM (male pool = his
// tasks for her, female pool = her tasks for him): 3 easy + 3 medium +
// 3 hard + 1 very hard, matched tier for tier in effort.
export const MALE_WEEKLY_POOL: QuestPoolItem[] = [
  { id: 'wm_note', difficulty: 'easy', titleKey: 'wm_note' },
  { id: 'wm_playlist', difficulty: 'easy', titleKey: 'wm_playlist' },
  { id: 'wm_grateful', difficulty: 'easy', titleKey: 'wm_grateful' },
  { id: 'wm_breakfast', difficulty: 'medium', titleKey: 'wm_breakfast' },
  { id: 'wm_walk', difficulty: 'medium', titleKey: 'wm_walk' },
  { id: 'wm_errand', difficulty: 'medium', titleKey: 'wm_errand' },
  { id: 'wm_cleaning', difficulty: 'hard', titleKey: 'wm_cleaning' },
  { id: 'wm_movie', difficulty: 'hard', titleKey: 'wm_movie' },
  { id: 'wm_massage', difficulty: 'hard', titleKey: 'wm_massage' },
  { id: 'wm_date', difficulty: 'veryHard', titleKey: 'wm_date' },
];

export const FEMALE_WEEKLY_POOL: QuestPoolItem[] = [
  { id: 'wf_voice', difficulty: 'easy', titleKey: 'wf_voice' },
  { id: 'wf_grateful', difficulty: 'easy', titleKey: 'wf_grateful' },
  { id: 'wf_photo', difficulty: 'easy', titleKey: 'wf_photo' },
  { id: 'wf_lunch', difficulty: 'medium', titleKey: 'wf_lunch' },
  { id: 'wf_game', difficulty: 'medium', titleKey: 'wf_game' },
  { id: 'wf_errand', difficulty: 'medium', titleKey: 'wf_errand' },
  { id: 'wf_dish', difficulty: 'hard', titleKey: 'wf_dish' },
  { id: 'wf_spa', difficulty: 'hard', titleKey: 'wf_spa' },
  { id: 'wf_surprise', difficulty: 'hard', titleKey: 'wf_surprise' },
  { id: 'wf_date', difficulty: 'veryHard', titleKey: 'wf_date' },
];
