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
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { usePlanning } from '../../store/PlanningContext';
import { useNotifications } from '../../store/NotificationsContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { isWithinDays } from '../../utils/date';
import { computeStreak } from '../../utils/streak';
import { formatBond, formatUsd } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyDigest'>;
const WEEK_DAYS = 7;

export const WeeklyDigestBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { configured } = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const planning = usePlanning();
  const { notifications } = useNotifications();
  const bond = useBond();

  const summary = useMemo(() => {
    const weekActions = sync.actionsList.filter((a) => isWithinDays(a.created_at, WEEK_DAYS));
    const earned = weekActions.filter((a) => a.points > 0).reduce((s, a) => s + a.points, 0);
    const spent = weekActions.filter((a) => a.points < 0).reduce((s, a) => s + Math.abs(a.points), 0);
    const net = earned - spent;

    const goalsCompleted = notifications.filter((n) => n.type === 'goal_completed' && isWithinDays(n.created_at, WEEK_DAYS)).length;

    const habitsStreak = planning.habits.reduce((max, habit) => {
      const dates = planning.habitLogs.filter((l) => l.habit_id === habit.id).map((l) => l.log_date);
      return Math.max(max, computeStreak(dates).current);
    }, 0);

    const requestsThisWeek =
      sync.rewardRequests.filter((r) => isWithinDays(r.created_at, WEEK_DAYS)).length +
      budget.purchaseRequests.filter((r) => isWithinDays(r.created_at, WEEK_DAYS)).length;

    const weekExpenses = budget.expenses.filter((e) => isWithinDays(e.expense_date, WEEK_DAYS));
    const spendingUsd = weekExpenses.reduce((s, e) => s + e.amount_usd, 0);

    return {
      actionsCount: weekActions.length,
      earned,
      spent,
      net,
      goalsCompleted,
      habitsStreak,
      requestsThisWeek,
      spendingUsd,
      hasData: weekActions.length > 0 || goalsCompleted > 0 || requestsThisWeek > 0 || weekExpenses.length > 0 || habitsStreak > 0,
    };
  }, [sync.actionsList, sync.rewardRequests, budget.purchaseRequests, budget.expenses, planning.habits, planning.habitLogs, notifications]);

  if (!configured) {
    return <ErrorState message={t('activityCenter.notConfigured')} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {!summary.hasData ? (
          <EmptyState icon="history" title={t('weeklyDigest.emptyTitle')} description={t('weeklyDigest.emptyDescription')} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label={t('weeklyDigest.together')} value={summary.actionsCount} emphasis />
              <StatCard label={t('weeklyDigest.goalsCompleted')} value={summary.goalsCompleted} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label={t('weeklyDigest.earned')} value={summary.earned} />
              <StatCard label={t('weeklyDigest.spentPoints')} value={summary.spent} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label={t('weeklyDigest.habitsStreak')} value={summary.habitsStreak} />
              <StatCard label={t('weeklyDigest.requests')} value={summary.requestsThisWeek} />
            </View>

            <View style={[styles.bigCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bigLabel, { color: colors.textSecondary }]}>{t('weeklyDigest.spending')}</Text>
              <Text style={[styles.bigValue, { color: colors.text }]}>${summary.spendingUsd.toFixed(2)}</Text>
            </View>

            <View style={[styles.bigCard, shadow.soft, { backgroundColor: colors.primary }]}>
              <Text style={[styles.bigLabel, { color: colors.textOnPrimary }]}>{t('weeklyDigest.bondEquivalent')}</Text>
              <Text style={[styles.bigValue, { color: colors.textOnPrimary }]}>
                {summary.net >= 0 ? '+' : ''}
                {formatBond(bond.toBond(summary.net))} BOND
              </Text>
              <Text style={[styles.bigSubValue, { color: colors.textOnPrimary }]}>
                {summary.net >= 0 ? '+' : ''}
                {formatUsd(bond.toBond(summary.net))}
              </Text>
            </View>
          </>
        )}
    </ScrollView>
  );
};

export const WeeklyDigestScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('weeklyDigest.title')} onBack={() => navigation.goBack()} />
      <WeeklyDigestBody />
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
  bigCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  bigLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  bigValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  bigSubValue: {
    fontSize: fontSize.xs,
    marginTop: 2,
    opacity: 0.85,
  },
});
