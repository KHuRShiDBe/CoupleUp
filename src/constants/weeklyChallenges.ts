import { TranslationKey } from '../localization/useTranslation';

export type ChallengeMetric = 'actions' | 'habits' | 'questions' | 'dates' | 'manual';

export interface WeeklyChallengeDef {
  key: string;
  titleKey: TranslationKey;
  metric: ChallengeMetric;
  target: number;
}

// Real, measurable metrics only, except "manual" (phone-free time can't be
// tracked automatically, so the couple self-reports it done -- still a real,
// timestamped action, just not auto-counted).
export const WEEKLY_CHALLENGE_POOL: WeeklyChallengeDef[] = [
  { key: 'five-actions', titleKey: 'weeklyChallenges.fiveActions', metric: 'actions', target: 5 },
  { key: 'phone-free-hour', titleKey: 'weeklyChallenges.phoneFreeHour', metric: 'manual', target: 1 },
  { key: 'three-habits', titleKey: 'weeklyChallenges.threeHabits', metric: 'habits', target: 3 },
  { key: 'five-questions', titleKey: 'weeklyChallenges.fiveQuestions', metric: 'questions', target: 5 },
  { key: 'one-date', titleKey: 'weeklyChallenges.oneDate', metric: 'dates', target: 1 },
];

// ISO week key (e.g. "2026-W37") -- the same for both partners on the same
// calendar week, with no server round-trip needed to agree on it.
export const getWeekKey = (date: Date = new Date()): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const weekNumber = (weekKey: string): number => parseInt(weekKey.split('-W')[1] ?? '0', 10);

// Deterministic rotation: 3 different challenges each week, no randomness,
// no repeats within the pool as long as the pool has at least 3 entries.
export const getWeekChallenges = (weekKey: string): WeeklyChallengeDef[] => {
  const n = weekNumber(weekKey);
  const len = WEEKLY_CHALLENGE_POOL.length;
  return [0, 1, 2].map((offset) => WEEKLY_CHALLENGE_POOL[(n + offset) % len]);
};
