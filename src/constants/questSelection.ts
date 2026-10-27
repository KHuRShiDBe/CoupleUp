// Every period's pool is now exactly 15 items (5 easy + 5 medium + 5 hard,
// see questEconomy.ts) -- the pool IS the period's fixed list, the same for
// everyone, every day/week/month/year. No rotation/randomness needed
// anymore, so this is just a gender-keyed lookup + a stable sort by tier.

import { Role } from '../types';
import { QuestPeriod } from '../types/database';
import { todayIso } from './dailyActions';
import { getWeekKey } from './weeklyChallenges';
import { QUEST_DIFFICULTIES } from './questEconomy';
import { MALE_DAILY_POOL, FEMALE_DAILY_POOL } from './questPools/daily';
import { MALE_WEEKLY_POOL, FEMALE_WEEKLY_POOL } from './questPools/weekly';
import { MALE_MONTHLY_POOL, FEMALE_MONTHLY_POOL } from './questPools/monthly';
import { MALE_YEARLY_POOL, FEMALE_YEARLY_POOL } from './questPools/yearly';
import { QuestPoolItem } from './questPools/types';

export { todayIso, getWeekKey };

export const getMonthKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const getYearKey = (date: Date = new Date()): string => String(date.getFullYear());

export const getPeriodKey = (period: QuestPeriod, date: Date = new Date()): string => {
  if (period === 'daily') return todayIso(date);
  if (period === 'weekly') return getWeekKey(date);
  if (period === 'monthly') return getMonthKey(date);
  return getYearKey(date);
};

const sortByTier = (items: QuestPoolItem[]): QuestPoolItem[] =>
  [...items].sort((a, b) => QUEST_DIFFICULTIES.indexOf(a.difficulty) - QUEST_DIFFICULTIES.indexOf(b.difficulty));

const POOLS: Record<QuestPeriod, Record<Role, QuestPoolItem[]>> = {
  daily: { male: MALE_DAILY_POOL, female: FEMALE_DAILY_POOL },
  weekly: { male: MALE_WEEKLY_POOL, female: FEMALE_WEEKLY_POOL },
  monthly: { male: MALE_MONTHLY_POOL, female: FEMALE_MONTHLY_POOL },
  yearly: { male: MALE_YEARLY_POOL, female: FEMALE_YEARLY_POOL },
};

// periodKey is kept as a parameter (unused here) so callers/signatures don't
// need to change -- it's still what scopes progress/completion in Supabase,
// just no longer used to pick a subset of a larger pool.
export const getQuestsFor = (
  period: QuestPeriod,
  _periodKey: string,
  _coupleId: string,
  doerRole: Role,
): QuestPoolItem[] => sortByTier(POOLS[period][doerRole]);
