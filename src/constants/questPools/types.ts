import { QuestDifficulty } from '../questEconomy';

export interface QuestPoolItem {
  id: string;
  // Resolved via t(`quests.item_${id}`).
  titleKey: string;
  // Every period's pool is tiered now (5 easy + 5 medium + 5 hard) -- see
  // questEconomy.ts.
  difficulty: QuestDifficulty;
}
