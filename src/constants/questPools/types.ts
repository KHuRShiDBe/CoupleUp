import { QuestDifficulty } from '../questEconomy';

export interface QuestPoolItem {
  id: string;
  // Resolved via t(`quests.item_${id}`).
  titleKey: string;
  // Tiered per questEconomy.ts (daily 3/3/3/1 incl. veryHard, others 5/5/5).
  difficulty: QuestDifficulty;
}
