import { QuestDifficulty } from '../questEconomy';

export interface QuestPoolItem {
  id: string;
  // Resolved via t(`quests.item_${id}`).
  titleKey: string;
  // Tiered per questEconomy.ts: 3 easy / 3 medium / 3 hard / 1 veryHard.
  difficulty: QuestDifficulty;
}
