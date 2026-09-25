// Intimate Roulette -- static content pool (same "static content, real log
// row" split as every other game in this app: the 15 options live here,
// client-side; only consent/settings/spin history are real Supabase rows --
// see migration 0022). Labels are resolved via
// t(`intimateRoulette.option_${key}`) so all 3 locales stay in sync.

import { IntimateRouletteAllowed } from '../types/database';

// 5x the wish roulette's cost (migration 0031), server-enforced in
// spin_intimate_roulette -- this is display-only, kept in sync by hand.
export const INTIMATE_ROULETTE_SPIN_COST_BOND = 10;

export type IntimateCategory = 'tender' | 'active' | 'dominant' | 'blindfold' | 'bondage' | 'roleplay';

export interface IntimateOption {
  key: string;
  // Empty array = always allowed, never filtered out by the category
  // toggles (used for the one neutral "decide together" option).
  categories: IntimateCategory[];
}

export const INTIMATE_OPTIONS: IntimateOption[] = [
  { key: 'missionary', categories: ['tender'] },
  { key: 'partner_on_top', categories: ['active'] },
  { key: 'partner_f_on_top', categories: ['active'] },
  { key: 'side_by_side', categories: ['tender'] },
  { key: 'slow_and_gentle', categories: ['tender'] },
  { key: 'he_dominates', categories: ['dominant'] },
  { key: 'she_dominates', categories: ['dominant'] },
  { key: 'blindfolded', categories: ['blindfold'] },
  { key: 'light_bondage', categories: ['bondage'] },
  { key: 'roleplay', categories: ['roleplay'] },
  { key: 'massage', categories: ['tender'] },
  { key: 'partner_surprise', categories: ['active'] },
  { key: 'kissing_only', categories: ['tender'] },
  { key: 'cuddling', categories: ['tender'] },
  { key: 'together_choice', categories: [] },
];

export const INTIMATE_CATEGORIES: IntimateCategory[] = ['tender', 'active', 'dominant', 'blindfold', 'bondage', 'roleplay'];

// Options with no category (or every one of their categories currently
// switched on) are eligible for this spin. "together_choice" has no
// category at all, so it's always in the pool -- the spin can never come up
// empty even if every toggle is off.
export const getAllowedOptions = (allowed: IntimateRouletteAllowed): IntimateOption[] =>
  INTIMATE_OPTIONS.filter((o) => o.categories.length === 0 || o.categories.some((c) => allowed[c]));

// True per-spin randomness (not the app's usual seeded/deterministic pick) --
// this is a personal "spin now" action, not something the two devices need
// to agree on independently; the actual result is logged and synced via
// intimate_roulette_results once chosen.
export const pickRandomOption = (allowed: IntimateRouletteAllowed): IntimateOption => {
  const pool = getAllowedOptions(allowed);
  const safePool = pool.length > 0 ? pool : INTIMATE_OPTIONS.filter((o) => o.key === 'together_choice');
  return safePool[Math.floor(Math.random() * safePool.length)];
};
