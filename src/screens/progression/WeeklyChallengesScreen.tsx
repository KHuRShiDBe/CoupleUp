import React, { useMemo } from 'react';
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
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { usePlanning } from '../../store/PlanningContext';
import { useProgression } from '../../store/ProgressionContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { isWithinDays } from '../../utils/date';
import { getWeekChallenges } from '../../constants/weeklyChallenges';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyChallenges'>;
const BONUS_POINTS = 5;

export const WeeklyChallengesScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const interaction = useCoupleInteraction();
  const planning = usePlanning();
  const progression = useProgression();

  const challenges = useMemo(() => getWeekChallenges(progression.weekKey), [progression.weekKey]);

  const progressFor = (metric: string, target: number): number => {
    switch (metric) {
      case 'actions':
        return sync.actionsList.filter((a) => isWithinDays(a.created_at, 7)).length;
      case 'habits': {
        const ids = new Set(planning.habitLogs.filter((l) => isWithinDays(l.created_at, 7)).map((l) => l.habit_id));
        return ids.size;
      }
      case 'questions':
        return interaction.dailyAnswers.filter((a) => a.user_id === auth.session?.user?.id && isWithinDays(a.created_at, 7)).length;
      case 'dates':
        return planning.planItems.filter((p) => p.kind === 'date' && p.done && isWithinDays(p.created_at, 7)).length;
      default:
        return 0;
    }
  };

  const handleManualComplete = (key: string) => {
    haptics.confirm();
    progression.completeChallenge(key);
  };

  const handleClaim = async (key: string, titleText: string) => {
    haptics.success();
    // One atomic server-side call (claim_challenge_reward, migration 0017):
    // marks the challenge complete (if it wasn't already, covering the
    // automatic/metric-based case) and pays the bonus exactly once, guarded
    // by reward_claimed -- replaces the old complete-then-claim two-step,
    // which raced against its own stale local state and could double-pay.
    await progression.claimChallengeReward(key, BONUS_POINTS, t('weeklyChallenges.rewardTitle', { title: titleText }));
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('weeklyChallenges.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {challenges.map((c) => {
          const dbRow = progression.challengeProgress.find((row) => row.challenge_key === c.key);
          const current = c.metric === 'manual' ? (dbRow?.completed ? 1 : 0) : Math.min(c.target, progressFor(c.metric, c.target));
          const done = current >= c.target || !!dbRow?.completed;
          const claimed = !!dbRow?.reward_claimed;
          const progressPct = Math.min(100, (current / c.target) * 100);

          return (
            <View key={c.key} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t(c.titleKey)}</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPct}%` }]} />
              </View>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {current} / {c.target}
              </Text>
              {c.metric === 'manual' && !done && (
                <PrimaryButton
                  label={t('weeklyChallenges.markDone')}
                  onPress={() => handleManualComplete(c.key)}
                  variant="outline"
                  style={styles.actionButton}
                />
              )}
              {done && !claimed && (
                <PrimaryButton label={t('weeklyChallenges.claim')} onPress={() => handleClaim(c.key, t(c.titleKey))} style={styles.actionButton} />
              )}
              {claimed && <Text style={[styles.claimedLabel, { color: colors.success }]}>{t('weeklyChallenges.claimed')}</Text>}
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
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  actionButton: {
    height: 40,
  },
  claimedLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
