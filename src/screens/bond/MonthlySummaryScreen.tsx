import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { StatCard } from '../../components/cards/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { usePlanning } from '../../store/PlanningContext';
import { useNotifications } from '../../store/NotificationsContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { formatBond, formatUsd } from '../../utils/bond';
import { isThisMonth } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'MonthlySummary'>;

export const MonthlySummaryScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const planning = usePlanning();
  const { notifications } = useNotifications();
  const bond = useBond();

  const summary = useMemo(() => {
    // Every figure below comes from the real, shared backend -- the same
    // `actionsList`/`rewardRequests`/`purchaseRequests`/`habitLogs` sources
    // Home/CoupleProfile/WeeklyDigest/History already use, so this screen
    // can never disagree with them about earned/spent/balance.
    const monthActions = sync.actionsList.filter((a) => isThisMonth(a.created_at));
    const earned = monthActions.filter((a) => a.points > 0).reduce((sum, a) => sum + a.points, 0);
    const spent = monthActions.filter((a) => a.points < 0).reduce((sum, a) => sum + Math.abs(a.points), 0);

    const monthRewardRequests = sync.rewardRequests.filter((r) => isThisMonth(r.created_at)).length;
    const monthPurchaseRequests = budget.purchaseRequests.filter((p) => isThisMonth(p.created_at)).length;

    // Real goal completions: notify_on_goal_completed (migration 0015) fires
    // exactly once per goal the moment current_points crosses target_points,
    // so this is a real count, not a re-derived guess.
    const monthGoalsClosed = notifications.filter((n) => n.type === 'goal_completed' && isThisMonth(n.created_at)).length;

    const monthHabitLogs = planning.habitLogs.filter((l) => isThisMonth(l.created_at)).length;

    return {
      earned,
      spent,
      net: earned - spent,
      actionCount: monthActions.length,
      monthRequests: monthRewardRequests + monthPurchaseRequests,
      monthGoalsClosed,
      monthHabitLogs,
      hasData: monthActions.length > 0 || monthRewardRequests > 0 || monthPurchaseRequests > 0 || monthGoalsClosed > 0 || monthHabitLogs > 0,
    };
  }, [sync.actionsList, sync.rewardRequests, budget.purchaseRequests, notifications, planning.habitLogs]);

  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (!auth.configured) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('monthlySummary.title')} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer>
    );
  }

  const initialLoading = sync.loading || budget.loading || planning.loading;

  return (
    <ScreenContainer>
      <ScreenHeader title={t('monthlySummary.title')} onBack={() => navigation.goBack()} />
      {initialLoading ? (
        <LoadingState lines={4} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={[styles.monthLabel, { color: colors.textSecondary }]}>{monthLabel}</Text>

          {!summary.hasData ? (
            <EmptyState
              icon="history"
              title={t('monthlySummary.emptyTitle')}
              description={t('monthlySummary.emptyDescription')}
            />
          ) : (
            <>
              <View style={styles.statsRow}>
                <StatCard label={t('monthlySummary.earned')} value={summary.earned} emphasis />
                <StatCard label={t('monthlySummary.spent')} value={summary.spent} />
              </View>

              <View style={[styles.netCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.netLabel, { color: colors.textSecondary }]}>{t('monthlySummary.balanceChange')}</Text>
                <Text style={[styles.netValue, { color: summary.net >= 0 ? colors.success : colors.danger }]}>
                  {summary.net >= 0 ? '+' : ''}
                  {summary.net} {t('bond.points')}
                </Text>
                <Text style={[styles.netEquivalent, { color: colors.textSecondary }]}>
                  ≈ {formatBond(bond.toBond(summary.net))} BOND · ≈ {formatUsd(bond.toBond(summary.net))}
                </Text>
              </View>

              <View style={styles.statsRow}>
                <StatCard label={t('monthlySummary.actions')} value={summary.actionCount} />
                <StatCard label={t('monthlySummary.requests')} value={summary.monthRequests} />
              </View>
              <View style={styles.statsRow}>
                <StatCard label={t('monthlySummary.goalsClosed')} value={summary.monthGoalsClosed} />
                <StatCard label={t('monthlySummary.habitLogs')} value={summary.monthHabitLogs} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  monthLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.lg,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  netCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  netLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  netValue: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  netEquivalent: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
