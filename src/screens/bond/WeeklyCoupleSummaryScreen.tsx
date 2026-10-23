import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { StatCard } from '../../components/cards/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { isWithinDays } from '../../utils/date';
import { formatBond, formatUsd } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyCoupleSummary'>;
const WEEK_DAYS = 7;

export const WeeklyCoupleSummaryScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const interaction = useCoupleInteraction();
  const bond = useBond();

  const summary = useMemo(() => {
    const weekActions = sync.actionsList.filter((a) => isWithinDays(a.created_at, WEEK_DAYS));
    const realActions = weekActions.filter((a) => a.type === 'action');
    const compliments = weekActions.filter((a) => a.type === 'compliment');
    const myEarned = weekActions.filter((a) => a.recipient_id === sync.userId && a.points > 0).reduce((s, a) => s + a.points, 0);
    const partnerEarned = weekActions
      .filter((a) => a.recipient_id === sync.partner?.id && a.points > 0)
      .reduce((s, a) => s + a.points, 0);
    const net = weekActions.reduce((s, a) => s + a.points, 0);
    // Real `tasks` table (Package #2) -- the legacy local completedTasks
    // array is no longer populated by anything since TasksScreen moved to
    // Supabase, so it would silently read as permanently empty here.
    const weekTasks = sync.tasks.filter((t2) => t2.status === 'completed' && t2.completed_at && isWithinDays(t2.completed_at, WEEK_DAYS));
    const weekAnswers = interaction.dailyAnswers.filter((a) => isWithinDays(a.created_at, WEEK_DAYS));
    const answerDates = new Set(weekAnswers.map((a) => a.question_date));
    const weekMoments = interaction.moments.filter((m) => isWithinDays(m.created_at, WEEK_DAYS));
    const bestMoment = weekMoments[0] ?? null;

    return {
      actionsCount: realActions.length,
      complimentsCount: compliments.length,
      myEarned,
      partnerEarned,
      net,
      tasksCount: weekTasks.length,
      answerDatesCount: answerDates.size,
      bestMoment,
      hasData: weekActions.length > 0 || weekTasks.length > 0 || weekAnswers.length > 0 || weekMoments.length > 0,
    };
  }, [sync.actionsList, sync.userId, sync.partner?.id, sync.tasks, interaction.dailyAnswers, interaction.moments]);

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('weeklySummary.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!summary.hasData ? (
          <EmptyState icon="history" title={t('weeklySummary.emptyTitle')} description={t('weeklySummary.emptyDescription')} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label={t('weeklySummary.actions')} value={summary.actionsCount} emphasis />
              <StatCard label={t('weeklySummary.compliments')} value={summary.complimentsCount} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label={t('weeklySummary.pointsEarnedMine')} value={summary.myEarned} />
              <StatCard label={t('weeklySummary.pointsEarnedPartner')} value={summary.partnerEarned} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label={t('weeklySummary.tasks')} value={summary.tasksCount} />
              <StatCard label={t('weeklySummary.questionAnswers')} value={summary.answerDatesCount} />
            </View>

            <View style={[styles.bondCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bondLabel, { color: colors.textSecondary }]}>{t('weeklySummary.bondChange')}</Text>
              <Text style={[styles.bondValue, { color: summary.net >= 0 ? colors.success : colors.danger }]}>
                {summary.net >= 0 ? '+' : ''}
                {formatBond(bond.toBond(summary.net))} BOND
              </Text>
              <Text style={[styles.bondUsd, { color: colors.textSecondary }]}>
                {summary.net >= 0 ? '+' : ''}
                {formatUsd(bond.toBond(summary.net))}
              </Text>
            </View>

            {summary.bestMoment && (
              <View style={[styles.momentCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.momentLabel, { color: colors.textSecondary }]}>{t('weeklySummary.bestMoment')}</Text>
                <Text style={[styles.momentTitle, { color: colors.text }]}>{summary.bestMoment.title}</Text>
                {!!summary.bestMoment.description && (
                  <Text style={[styles.momentDescription, { color: colors.textSecondary }]}>
                    {summary.bestMoment.description}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bondCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  bondLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  bondValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  bondUsd: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  momentCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  momentLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  momentTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  momentDescription: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
});
