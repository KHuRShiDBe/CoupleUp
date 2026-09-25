import { TranslationKey } from '../localization/useTranslation';

export interface RewardMilestoneDef {
  key: string;
  titleKey: TranslationKey;
  points: number;
}

// Fixed, guaranteed rewards -- no randomness, nothing purchasable. Each
// milestone is claimable exactly once per couple (enforced by the unique
// constraint on reward_claims(couple_id, milestone_key)).
export const REWARD_MILESTONES: RewardMilestoneDef[] = [
  { key: 'streak7', titleKey: 'rewardChest.streak7', points: 20 },
  { key: 'level5', titleKey: 'rewardChest.level5', points: 50 },
  { key: 'fiveChallenges', titleKey: 'rewardChest.fiveChallenges', points: 100 },
];
