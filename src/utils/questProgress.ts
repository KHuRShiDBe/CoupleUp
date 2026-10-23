import { Role } from '../types';
import { DbQuestCustomItem, DbQuestHiddenItem, DbQuestProgress, QuestPeriod } from '../types/database';
import { getQuestsFor } from '../constants/questSelection';

interface QuestProgressInput {
  period: QuestPeriod;
  periodKey: string;
  coupleId: string;
  // The gender-themed pool this person's quests are drawn from -- NOT their
  // own role, but their partner's (see questSelection.ts/getQuestsFor): a
  // male person's quests are the FEMALE pool's items, and vice versa.
  poolRole: Role;
  userId: string;
  progress: DbQuestProgress[];
  customItems: DbQuestCustomItem[];
  hiddenItems: DbQuestHiddenItem[];
}

// Same done/total definition RewardsScreen uses for the signed-in viewer
// (standard pool items minus ones they've hidden, plus same-value
// replacements) -- reused here, unmodified, to show the identical real
// count for EITHER person from Home, not a separate/approximate number.
export const computeQuestProgress = ({
  period,
  periodKey,
  coupleId,
  poolRole,
  userId,
  progress,
  customItems,
  hiddenItems,
}: QuestProgressInput): { done: number; total: number } => {
  const hiddenKeys = new Set(
    hiddenItems.filter((h) => h.user_id === userId && h.period === period).map((h) => h.item_key),
  );
  const systemQuests = getQuestsFor(period, periodKey, coupleId, poolRole).filter((item) => !hiddenKeys.has(item.id));
  const replacementCustomItems = customItems.filter(
    (c) => c.period === period && c.period_key === periodKey && !!c.replaces_item_key,
  );
  const isCompleted = (itemKey: string) =>
    progress.some((p) => p.period === period && p.period_key === periodKey && p.item_key === itemKey);

  return {
    total: systemQuests.length + replacementCustomItems.length,
    done: systemQuests.filter((item) => isCompleted(item.id)).length + replacementCustomItems.filter((c) => isCompleted(c.item_key)).length,
  };
};
