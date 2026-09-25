// Generic (non-intimate) couple roulette content -- placeholder set, easy
// to replace: nothing outside CoupleRouletteScreen.tsx reads this file's
// shape besides `key`/`titleKey`, so swapping ROULETTE_ITEMS is a
// one-file change.

export interface RouletteItem {
  key: string;
  titleKey: string;
}

export const ROULETTE_ITEMS: RouletteItem[] = [
  { key: 'movie_night', titleKey: 'movie_night' },
  { key: 'new_recipe', titleKey: 'new_recipe' },
  { key: 'park_walk', titleKey: 'park_walk' },
  { key: 'board_game_night', titleKey: 'board_game_night' },
  { key: 'picnic', titleKey: 'picnic' },
  { key: 'new_restaurant', titleKey: 'new_restaurant' },
  { key: 'photo_session', titleKey: 'photo_session' },
  { key: 'game_choice', titleKey: 'game_choice' },
];
