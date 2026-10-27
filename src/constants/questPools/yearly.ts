import { QuestPoolItem } from './types';

// 10 items per role, written to the PERSON WHO DOES THEM (male pool = his
// tasks for her, female pool = her tasks for him): 3 easy + 3 medium +
// 3 hard + 1 very hard, matched tier for tier in effort.
export const MALE_YEARLY_POOL: QuestPoolItem[] = [
  { id: 'ym_letter', difficulty: 'easy', titleKey: 'ym_letter' },
  { id: 'ym_tradition', difficulty: 'easy', titleKey: 'ym_tradition' },
  { id: 'ym_keepsake', difficulty: 'easy', titleKey: 'ym_keepsake' },
  { id: 'ym_anniv', difficulty: 'medium', titleKey: 'ym_anniv' },
  { id: 'ym_family', difficulty: 'medium', titleKey: 'ym_family' },
  { id: 'ym_book', difficulty: 'medium', titleKey: 'ym_book' },
  { id: 'ym_course', difficulty: 'hard', titleKey: 'ym_course' },
  { id: 'ym_project', difficulty: 'hard', titleKey: 'ym_project' },
  { id: 'ym_challenge', difficulty: 'hard', titleKey: 'ym_challenge' },
  { id: 'ym_vacation', difficulty: 'veryHard', titleKey: 'ym_vacation' },
];

export const FEMALE_YEARLY_POOL: QuestPoolItem[] = [
  { id: 'yf_letter', difficulty: 'easy', titleKey: 'yf_letter' },
  { id: 'yf_wishlist', difficulty: 'easy', titleKey: 'yf_wishlist' },
  { id: 'yf_keepsake', difficulty: 'easy', titleKey: 'yf_keepsake' },
  { id: 'yf_anniv', difficulty: 'medium', titleKey: 'yf_anniv' },
  { id: 'yf_friends', difficulty: 'medium', titleKey: 'yf_friends' },
  { id: 'yf_film', difficulty: 'medium', titleKey: 'yf_film' },
  { id: 'yf_class', difficulty: 'hard', titleKey: 'yf_class' },
  { id: 'yf_dream', difficulty: 'hard', titleKey: 'yf_dream' },
  { id: 'yf_habit', difficulty: 'hard', titleKey: 'yf_habit' },
  { id: 'yf_vacation', difficulty: 'veryHard', titleKey: 'yf_vacation' },
];
