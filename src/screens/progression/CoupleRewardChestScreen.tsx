import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useProgression } from '../../store/ProgressionContext';
import { useCoupleStats } from '../../store/useCoupleStats';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { REWARD_MILESTONES } from '../../constants/rewardChest';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleRewardChest'>;

const isMilestoneReached = (key: string, stats: ReturnType<typeof useCoupleStats>, totalCompletedChallenges: number): boolean => {
  switch (key) {
    case 'streak7':
      return stats.bestStreak >= 7;
    case 'level5':
      return stats.level.level >= 5;
    case 'fiveChallenges':
      return totalCompletedChallenges >= 5;
    default:
      return false;
  }
};

export const CoupleRewardChestScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const progression = useProgression();
  const stats = useCoupleStats();

  const handleClaim = async (key: string, points: number) => {
    if (!auth.session?.user?.id) return;
    haptics.success();
    const claimed = await progression.claimReward(key, points);
    if (claimed) {
      // 'reward_chest' -- immediate, system-verified reward (not a
      // self-reported action), so no partner approval needed; this type is
      // also what keeps the generic "Новое доброе дело" notification from
      // firing (notify_on_action_insert doesn't handle it, migration 0040).
      await sync.addAction(t('rewardChest.rewardActionTitle'), points, auth.session.user.id, 'reward_chest');
    }
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('rewardChest.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('rewardChest.subtitle')}</Text>
        {REWARD_MILESTONES.map((m) => {
          const claim = progression.rewardClaims.find((c) => c.milestone_key === m.key);
          const reached = isMilestoneReached(m.key, stats, progression.totalCompletedChallenges);

          return (
            <View key={m.key} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t(m.titleKey)}</Text>
                <Text style={[styles.points, { color: colors.primary }]}>+{m.points}</Text>
              </View>
              {claim ? (
                <Text style={[styles.status, { color: colors.success }]}>{t('rewardChest.claimed')}</Text>
              ) : reached ? (
                <PrimaryButton label={t('rewardChest.claim')} onPress={() => handleClaim(m.key, m.points)} style={styles.claimButton} />
              ) : (
                <Text style={[styles.status, { color: colors.textSecondary }]}>{t('rewardChest.locked')}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  points: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  status: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  claimButton: {
    height: 44,
  },
});
