import { QuestPoolItem } from './types';

// 15 items each, 5 easy + 5 medium + 5 hard (see questEconomy.ts). The
// user's examples for yearly quests weren't gendered -- both arrays are
// intentionally close in content (a trip, an anniversary, a big shared
// project are not gendered activities), but structurally independent, so
// they can diverge later without touching questSelection.ts.
export const MALE_YEARLY_POOL: QuestPoolItem[] = [
  { id: 'my_year_letter', difficulty: 'easy', titleKey: 'my_year_letter' },
  { id: 'my_memory_album', difficulty: 'easy', titleKey: 'my_memory_album' },
  { id: 'my_bucket_list', difficulty: 'easy', titleKey: 'my_bucket_list' },
  { id: 'my_thank_you_year', difficulty: 'easy', titleKey: 'my_thank_you_year' },
  { id: 'my_tradition', difficulty: 'easy', titleKey: 'my_tradition' },

  { id: 'my_big_gift', difficulty: 'medium', titleKey: 'my_big_gift' },
  { id: 'my_big_event', difficulty: 'medium', titleKey: 'my_big_event' },
  { id: 'my_fulfil_big_wish', difficulty: 'medium', titleKey: 'my_fulfil_big_wish' },
  { id: 'my_weekend_trip', difficulty: 'medium', titleKey: 'my_weekend_trip' },
  { id: 'my_shared_hobby_goal', difficulty: 'medium', titleKey: 'my_shared_hobby_goal' },

  { id: 'my_travel', difficulty: 'hard', titleKey: 'my_travel' },
  { id: 'my_anniversary', difficulty: 'hard', titleKey: 'my_anniversary' },
  { id: 'my_big_goal', difficulty: 'hard', titleKey: 'my_big_goal' },
  { id: 'my_big_project', difficulty: 'hard', titleKey: 'my_big_project' },
  { id: 'my_family_celebration', difficulty: 'hard', titleKey: 'my_family_celebration' },
];

export const FEMALE_YEARLY_POOL: QuestPoolItem[] = [
  { id: 'fy_year_letter', difficulty: 'easy', titleKey: 'fy_year_letter' },
  { id: 'fy_memory_album', difficulty: 'easy', titleKey: 'fy_memory_album' },
  { id: 'fy_bucket_list', difficulty: 'easy', titleKey: 'fy_bucket_list' },
  { id: 'fy_thank_you_year', difficulty: 'easy', titleKey: 'fy_thank_you_year' },
  { id: 'fy_tradition', difficulty: 'easy', titleKey: 'fy_tradition' },

  { id: 'fy_big_gift', difficulty: 'medium', titleKey: 'fy_big_gift' },
  { id: 'fy_big_event', difficulty: 'medium', titleKey: 'fy_big_event' },
  { id: 'fy_fulfil_big_wish', difficulty: 'medium', titleKey: 'fy_fulfil_big_wish' },
  { id: 'fy_weekend_trip', difficulty: 'medium', titleKey: 'fy_weekend_trip' },
  { id: 'fy_shared_hobby_goal', difficulty: 'medium', titleKey: 'fy_shared_hobby_goal' },

  { id: 'fy_travel', difficulty: 'hard', titleKey: 'fy_travel' },
  { id: 'fy_anniversary', difficulty: 'hard', titleKey: 'fy_anniversary' },
  { id: 'fy_big_goal', difficulty: 'hard', titleKey: 'fy_big_goal' },
  { id: 'fy_big_project', difficulty: 'hard', titleKey: 'fy_big_project' },
  { id: 'fy_family_celebration', difficulty: 'hard', titleKey: 'fy_family_celebration' },
];
