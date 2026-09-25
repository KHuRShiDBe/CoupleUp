// Daily Required Actions -- static content pool (same "static content, real
// completion state" split as every other game/challenge in this app: the
// definitions live here, client-side, identical on every install; only
// completion is a real Supabase row -- see migration 0019).

export type DailyActionCategory = 'care' | 'time' | 'words' | 'home' | 'romance';

export interface DailyActionDef {
  id: string;
  category: DailyActionCategory;
  titleKey: string; // resolved via t(`dailyActions.item_${id}`)
  points: number;
}

export const DAILY_ACTION_POOL: DailyActionDef[] = [
  // CARE
  { id: 'hot_drink', category: 'care', titleKey: 'hot_drink', points: 10 },
  { id: 'chocolate', category: 'care', titleKey: 'chocolate', points: 10 },
  { id: 'favorite_treat', category: 'care', titleKey: 'favorite_treat', points: 15 },
  { id: 'small_help', category: 'care', titleKey: 'small_help', points: 15 },
  // TIME
  { id: 'walk_together', category: 'time', titleKey: 'walk_together', points: 15 },
  { id: 'together_15', category: 'time', titleKey: 'together_15', points: 20 },
  { id: 'together_30', category: 'time', titleKey: 'together_30', points: 25 },
  { id: 'phone_free_evening', category: 'time', titleKey: 'phone_free_evening', points: 25 },
  // WORDS
  { id: 'compliment', category: 'words', titleKey: 'compliment', points: 10 },
  { id: 'thank_you', category: 'words', titleKey: 'thank_you', points: 10 },
  { id: 'nice_message', category: 'words', titleKey: 'nice_message', points: 10 },
  // HOME
  { id: 'help_chores', category: 'home', titleKey: 'help_chores', points: 20 },
  { id: 'cook_something', category: 'home', titleKey: 'cook_something', points: 20 },
  { id: 'household_task', category: 'home', titleKey: 'household_task', points: 15 },
  // ROMANCE
  { id: 'hug', category: 'romance', titleKey: 'hug', points: 10 },
  { id: 'small_surprise', category: 'romance', titleKey: 'small_surprise', points: 25 },
  { id: 'mini_date', category: 'romance', titleKey: 'mini_date', points: 30 },
];

export const DAILY_ACTION_BY_ID: Record<string, DailyActionDef> = Object.fromEntries(
  DAILY_ACTION_POOL.map((a) => [a.id, a]),
);

export const DAILY_BONUS_POINTS = 50;
export const WHEEL_VALUES = [5, 10, 15, 20, 25, 30] as const;

// Same DJB2-style string hash used for TruthOrDare's deterministic prompt
// pick (gameContent.ts) -- stable, well-mixed, not cryptographic, doesn't
// need to be.
const hashString = (input: string): number => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
};

// Tiny seeded PRNG (mulberry32) so the same (coupleId, date) seed always
// produces the same sequence -- this is what makes "3-5 actions" and "which
// 3-5" identical on both phones without either one calling the other.
const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Deterministic 3-5 item selection for (coupleId, dateIso 'YYYY-MM-DD').
// Both partners' phones compute this independently and always agree.
export const getDailyActionsFor = (coupleId: string, dateIso: string): DailyActionDef[] => {
  const seed = hashString(`${coupleId}:${dateIso}`);
  const rand = mulberry32(seed);
  const count = 3 + Math.floor(rand() * 3); // 3, 4, or 5

  const pool = [...DAILY_ACTION_POOL];
  // Partial Fisher-Yates, seeded -- deterministic given `rand`'s sequence.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a.id.localeCompare(b.id));
};

export const todayIso = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
