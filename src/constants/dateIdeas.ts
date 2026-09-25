import { TranslationKey } from '../localization/useTranslation';

export type DateIdeaCategory = 'home' | 'walk' | 'restaurant' | 'active' | 'romance' | 'trip';

export const DATE_IDEA_CATEGORIES: DateIdeaCategory[] = ['home', 'walk', 'restaurant', 'active', 'romance', 'trip'];

export interface DateIdea {
  key: string;
  titleKey: TranslationKey;
  category: DateIdeaCategory;
}

// Static, shipped-with-the-app content -- not stored in Supabase. Only a
// *saved* idea ("Хотим попробовать") is real, couple-shared data.
export const DATE_IDEAS: DateIdea[] = [
  { key: 'cook-together', titleKey: 'dateIdeas.idea1', category: 'home' },
  { key: 'no-phones-evening', titleKey: 'dateIdeas.idea2', category: 'home' },
  { key: 'new-place-walk', titleKey: 'dateIdeas.idea3', category: 'walk' },
  { key: 'picnic', titleKey: 'dateIdeas.idea4', category: 'walk' },
  { key: 'movie', titleKey: 'dateIdeas.idea5', category: 'home' },
  { key: 'board-game', titleKey: 'dateIdeas.idea6', category: 'home' },
  { key: 'out-of-town', titleKey: 'dateIdeas.idea7', category: 'trip' },
];
