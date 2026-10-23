import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { HowItWorksNote } from '../../components/common/HowItWorksNote';
import { DailyRewardWheel } from '../../components/daily/DailyRewardWheel';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useDailyActions } from '../../store/DailyActionsContext';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { DAILY_BONUS_POINTS, getDailyActionsFor, todayIso } from '../../constants/dailyActions';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyTasks'>;

export const DailyTasksBody = ({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>;
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const daily = useDailyActions();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);

  const today = todayIso();
  const coupleId = sync.couple?.id ?? null;
  const todaysActions = useMemo(() => (coupleId ? getDailyActionsFor(coupleId, today) : []), [coupleId, today]);

  const todaysCompletions = daily.completions.filter((c) => c.action_date === today);
  const completedIds = new Set(todaysCompletions.map((c) => c.action_id));
  const doneCount = todaysActions.filter((a) => completedIds.has(a.id)).length;
  const allDone = todaysActions.length > 0 && doneCount === todaysActions.length;
  const pointsToday = todaysCompletions.reduce((s, c) => s + c.points, 0);

  const todaysProgress = daily.progress.find((p) => p.progress_date === today);
  const bonusClaimed = todaysProgress?.bonus_claimed ?? false;
  const wheelReward = todaysProgress?.wheel_reward_points ?? null;

  const handleComplete = async (actionId: string, points: number) => {
    if (completingId) return;
    haptics.success();
    setCompletingId(actionId);
    try {
      await daily.completeAction(actionId, today, points, t(`dailyActions.item_${actionId}` as TranslationKey));
    } finally {
      setCompletingId(null);
    }
  };

  const handleClaimBonus = async () => {
    if (claimingBonus) return;
    haptics.success();
    setClaimingBonus(true);
    try {
      await daily.claimBonus(today, todaysActions.length, DAILY_BONUS_POINTS, t('dailyActions.bonusTitle'));
    } finally {
      setClaimingBonus(false);
    }
  };

  const handleSpin = async (): Promise<number | null> => daily.spinWheel(today, t('dailyActions.wheelTitle'));

  if (!auth.configured) {
    return <ErrorState message={t('activityCenter.notConfigured')} />;
  }

  if (daily.loading && daily.completions.length === 0 && todaysActions.length === 0) {
    return <LoadingState lines={4} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {!!daily.error && <BackendStatusBanner message={daily.error} onRetry={daily.clearError} />}
          <HowItWorksNote text={t('dailyActions.howItWorksText')} />

          <View style={[styles.progressCard, shadow.soft, { backgroundColor: colors.primary }]}>
            <Text style={[styles.progressValue, { color: colors.textOnPrimary }]}>
              {doneCount} / {todaysActions.length}
            </Text>
            <Text style={[styles.progressLabel, { color: colors.textOnPrimary }]}>{t('dailyActions.progressLabel')}</Text>
            <Text style={[styles.progressPoints, { color: colors.textOnPrimary }]}>
              {t('dailyActions.pointsToday', { points: pointsToday })}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('DailyCalendar')}
            style={[styles.calendarLink, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={[styles.calendarLinkText, { color: colors.primary }]}>{t('dailyActions.openCalendar')}</Text>
          </Pressable>

          {todaysActions.map((action) => {
            const done = completedIds.has(action.id);
            return (
              <View
                key={action.id}
                style={[
                  styles.card,
                  shadow.soft,
                  { backgroundColor: done ? colors.background : colors.card, borderColor: colors.border, opacity: done ? 0.7 : 1 },
                ]}
              >
                <View style={styles.cardBody}>
                  <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>
                    {t(`dailyActions.category_${action.category}` as TranslationKey)}
                  </Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {t(`dailyActions.item_${action.id}` as TranslationKey)}
                  </Text>
                </View>
                <Text style={[styles.cardPoints, { color: done ? colors.textSecondary : colors.success }]}>+{action.points}</Text>
                {done ? (
                  <View style={[styles.doneBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.doneBadgeText}>✓</Text>
                  </View>
                ) : (
                  <PrimaryButton
                    label={t('dailyActions.markDone')}
                    onPress={() => handleComplete(action.id, action.points)}
                    disabled={completingId === action.id}
                    loading={completingId === action.id}
                    style={styles.cardButton}
                  />
                )}
              </View>
            );
          })}

          {allDone && (
            <View style={[styles.bonusCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bonusTitle, { color: colors.text }]}>{t('dailyActions.bonusTitle')}</Text>
              {bonusClaimed ? (
                <Text style={[styles.bonusClaimed, { color: colors.success }]}>
                  {t('dailyActions.bonusClaimed', { points: DAILY_BONUS_POINTS })}
                </Text>
              ) : (
                <PrimaryButton
                  label={t('dailyActions.claimBonus', { points: DAILY_BONUS_POINTS })}
                  onPress={handleClaimBonus}
                  disabled={claimingBonus}
                  loading={claimingBonus}
                />
              )}
            </View>
          )}

          {allDone && (
            <View style={[styles.wheelCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bonusTitle, { color: colors.text }]}>{t('dailyWheel.title')}</Text>
              <Text style={[styles.wheelNote, { color: colors.textSecondary }]}>{t('dailyWheel.note')}</Text>
              <DailyRewardWheel alreadySpunReward={wheelReward} disabled={false} onSpin={handleSpin} />
            </View>
          )}
    </ScrollView>
  );
};

export const DailyTasksScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('dailyActions.title')} onBack={() => navigation.goBack()} />
      <DailyTasksBody navigation={navigation} />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  progressCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressValue: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  progressLabel: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  progressPoints: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  calendarLink: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.round,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  calendarLinkText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardCategory: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardPoints: {
    fontSize: fontSize.md,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  cardButton: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
  doneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadgeText: {
    color: '#fff',
    fontWeight: '800',
  },
  bonusCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  bonusTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  bonusClaimed: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  wheelCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  wheelNote: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
