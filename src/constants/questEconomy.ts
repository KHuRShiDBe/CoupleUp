// Central quest economy config -- every price shown anywhere in the quest
// system (Rewards' daily/weekly/monthly/yearly tabs, the custom-add price
// preview) reads from here. Nothing is hardcoded inline elsewhere.
//
// Economy (migration 0047): 100 points = 1 BOND ~= $1. A user can earn at
// most 5 BOND (500 points at the base rate) per day from tasks + bonuses --
// enforced server-side in respond_action_request / claim_quest_bonus. The
// full daily list + its bonuses is worth 4 BOND, leaving room for
// weekly/monthly items on the same day.
//
// Daily: 10 items per partner -- 3 easy + 3 medium + 3 hard + 1 very hard.
// Weekly/monthly/yearly keep 5 easy + 5 medium + 5 hard.

import { QuestPeriod } from '../types/database';

export type QuestDifficulty = 'easy' | 'medium' | 'hard' | 'veryHard';

export const QUEST_DIFFICULTIES: QuestDifficulty[] = ['easy', 'medium', 'hard', 'veryHard'];

export const QUEST_TIER_COUNTS: Record<QuestPeriod, Record<QuestDifficulty, number>> = {
  daily: { easy: 3, medium: 3, hard: 3, veryHard: 1 },
  weekly: { easy: 5, medium: 5, hard: 5, veryHard: 0 },
  monthly: { easy: 5, medium: 5, hard: 5, veryHard: 0 },
  yearly: { easy: 5, medium: 5, hard: 5, veryHard: 0 },
};

export const questItemsPerPeriod = (period: QuestPeriod): number =>
  QUEST_DIFFICULTIES.reduce((sum, tier) => sum + QUEST_TIER_COUNTS[period][tier], 0);

// Points per item. Daily: 3x15 + 3x25 + 3x40 + 1x60 = 300 points (3 BOND).
// No single item exceeds the 500-point daily cap. veryHard is only used by
// the daily pool; the other periods' values exist for type completeness.
export const QUEST_BASE_POINTS: Record<QuestPeriod, Record<QuestDifficulty, number>> = {
  daily: { easy: 15, medium: 25, hard: 40, veryHard: 60 },
  weekly: { easy: 20, medium: 40, hard: 60, veryHard: 80 },
  monthly: { easy: 50, medium: 100, hard: 150, veryHard: 200 },
  yearly: { easy: 200, medium: 350, hard: 500, veryHard: 500 },
};

// Milestone bonuses -- daily AND weekly only. Cumulative, each paid at most
// once per (user, period, period_key), immediately (no extra approval: the
// counted items were already confirmed by the partner). Must match
// claim_quest_bonus (migration 0047). Daily: 20 + 30 + 50 = 100 points.
export const QUEST_BONUS_MILESTONES_BY_PERIOD: Partial<Record<QuestPeriod, { count: number; points: number }[]>> = {
  daily: [
    { count: 5, points: 20 },
    { count: 7, points: 30 },
    { count: 10, points: 50 },
  ],
  weekly: [
    { count: 5, points: 20 },
    { count: 7, points: 30 },
    { count: 15, points: 50 },
  ],
};

export const QUEST_BONUS_PERIODS: QuestPeriod[] = ['daily', 'weekly'];

// Free quests per period == the system-generated count for that period
// (10 daily, 15 otherwise). The next user-added custom item is the first
// "extra" one.
export const QUEST_FREE_COUNT: Record<QuestPeriod, number> = {
  daily: questItemsPerPeriod('daily'),
  weekly: questItemsPerPeriod('weekly'),
  monthly: questItemsPerPeriod('monthly'),
  yearly: questItemsPerPeriod('yearly'),
};

// Each extra custom item beyond the free count costs the period's average
// base price times this factor, compounding per extra item (1st extra =
// ^1, 2nd extra = ^2, ...). Centralized so the whole "extras get pricier"
// curve is one number to change.
export const EXTRA_ITEM_GROWTH = 1.1;

export const averageBasePoints = (period: QuestPeriod): number => {
  const tiers = QUEST_BASE_POINTS[period];
  const counts = QUEST_TIER_COUNTS[period];
  const total = QUEST_DIFFICULTIES.reduce((s, tier) => s + counts[tier] * tiers[tier], 0);
  return total / questItemsPerPeriod(period);
};

// overflowIndex: 1 for the first item past the free count, 2 for the next, etc.
export const computeExtraQuestPoints = (period: QuestPeriod, overflowIndex: number): number =>
  Math.round(averageBasePoints(period) * EXTRA_ITEM_GROWTH ** overflowIndex);

// Given how many custom items a couple has already added this period
// (existingCustomCount) and how many system-generated items exist
// (systemCount), returns the price for the NEXT custom item they add.
export const nextCustomQuestPrice = (period: QuestPeriod, systemCount: number, existingCustomCount: number): number => {
  const totalSoFar = systemCount + existingCustomCount;
  const freeCount = QUEST_FREE_COUNT[period];
  if (totalSoFar < freeCount) {
    return Math.round(averageBasePoints(period));
  }
  const overflowIndex = totalSoFar - freeCount + 1;
  return computeExtraQuestPoints(period, overflowIndex);
};
