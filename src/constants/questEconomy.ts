// Central quest economy config -- every price shown anywhere in the quest
// system (Rewards' daily/weekly/monthly/yearly tabs, the custom-add price
// preview) reads from here. Nothing is hardcoded inline elsewhere.
//
// Uniform shape across all 4 periods (confirmed with the user): exactly 15
// items per period per gender, split 5 easy + 5 medium + 5 hard, priced on a
// fixed per-period/per-tier scale that scales up period over period (daily
// cheapest, yearly priciest) so effort and reward stay proportional.

import { QuestPeriod } from '../types/database';

export type QuestDifficulty = 'easy' | 'medium' | 'hard';

export const QUEST_DIFFICULTIES: QuestDifficulty[] = ['easy', 'medium', 'hard'];

// Same 5/5/5 split for every period.
export const QUEST_ITEMS_PER_TIER = 5;
export const QUEST_ITEMS_PER_PERIOD = QUEST_ITEMS_PER_TIER * QUEST_DIFFICULTIES.length; // 15

// Reward scale (spec table): higher period + higher tier = higher reward,
// never a large reward for a quick action.
export const QUEST_BASE_POINTS: Record<QuestPeriod, Record<QuestDifficulty, number>> = {
  daily: { easy: 5, medium: 10, hard: 15 },
  weekly: { easy: 20, medium: 40, hard: 60 },
  monthly: { easy: 50, medium: 100, hard: 150 },
  yearly: { easy: 200, medium: 400, hard: 600 },
};

// Milestone bonuses -- daily AND weekly only (spec item 5: monthly/yearly get
// no extra tiers beyond their normal per-item reward). Cumulative: 5th item
// pays +20, 7th pays another +30 (50 total), 15th (= all items done) pays
// another +50 (100 total). Each stage is paid out at most once per (user,
// period, period_key) and requires partner approval -- see claim_quest_bonus
// in migrations 0033/0043.
export const QUEST_BONUS_MILESTONES: { count: number; points: number }[] = [
  { count: 5, points: 20 },
  { count: 7, points: 30 },
  { count: 15, points: 50 },
];

export const QUEST_BONUS_PERIODS: QuestPeriod[] = ['daily', 'weekly'];

// Free quests per period == the system-generated count for that period (15,
// same for every period now). The 16th user-added custom item is the first
// "extra" one.
export const QUEST_FREE_COUNT: Record<QuestPeriod, number> = {
  daily: QUEST_ITEMS_PER_PERIOD,
  weekly: QUEST_ITEMS_PER_PERIOD,
  monthly: QUEST_ITEMS_PER_PERIOD,
  yearly: QUEST_ITEMS_PER_PERIOD,
};

// Each extra custom item beyond the free count costs the period's average
// base price times this factor, compounding per extra item (1st extra =
// ^1, 2nd extra = ^2, ...). Centralized so the whole "extras get pricier"
// curve is one number to change.
export const EXTRA_ITEM_GROWTH = 1.1;

export const averageBasePoints = (period: QuestPeriod): number => {
  const tiers = QUEST_BASE_POINTS[period];
  const total = QUEST_DIFFICULTIES.reduce((s, tier) => s + QUEST_ITEMS_PER_TIER * tiers[tier], 0);
  return total / QUEST_ITEMS_PER_PERIOD;
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
