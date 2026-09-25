import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useTranslation } from '../../localization/useTranslation';
import { isThisMonth, isThisYear, isToday, isWithinDays } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Finance'>;
type FinancePeriod = 'today' | 'week' | 'month' | 'year';

const inPeriod = (iso: string, period: FinancePeriod): boolean => {
  if (period === 'today') return isToday(iso);
  if (period === 'week') return isWithinDays(iso, 7);
  if (period === 'month') return isThisMonth(iso);
  return isThisYear(iso);
};

export const FinanceScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const budget = useBudget();
  const [period, setPeriod] = useState<FinancePeriod>('today');

  const periodTabs = [
    { key: 'today', label: t('finance.periodToday') },
    { key: 'week', label: t('finance.periodWeek') },
    { key: 'month', label: t('finance.periodMonth') },
    { key: 'year', label: t('finance.periodYear') },
  ];

  const actionsInPeriod = useMemo(
    () => sync.actionsList.filter((a) => inPeriod(a.created_at, period)),
    [sync.actionsList, period],
  );
  const earned = actionsInPeriod.filter((a) => a.points > 0).reduce((s, a) => s + a.points, 0);
  const spent = actionsInPeriod.filter((a) => a.points < 0).reduce((s, a) => s + Math.abs(a.points), 0);

  const expensesInPeriod = useMemo(
    () => budget.expenses.filter((e) => inPeriod(e.expense_date, period)),
    [budget.expenses, period],
  );
  const expensesTotalUsd = expensesInPeriod.reduce((s, e) => s + e.amount_usd, 0);

  const rewardsInPeriod = useMemo(
    () => sync.rewardRequests.filter((r) => r.status === 'accepted' && inPeriod(r.resolved_at ?? r.created_at, period)),
    [sync.rewardRequests, period],
  );

  const recentOps = useMemo(
    () =>
      [...actionsInPeriod]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
    [actionsInPeriod],
  );

  const goToHistory = () => {
    navigation.navigate('History');
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('finance.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FilterTabs options={periodTabs} value={period} onChange={(key) => setPeriod(key as FinancePeriod)} />

        <View style={[styles.balanceCard, shadow.soft, { backgroundColor: colors.primary }]}>
          <Text style={[styles.balanceLabel, { color: colors.textOnPrimary }]}>{t('finance.coupleBalance')}</Text>
          <Text style={[styles.balanceValue, { color: colors.textOnPrimary }]}>{sync.couple?.points ?? 0}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>+{earned}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('finance.earned')}</Text>
          </View>
          <View style={[styles.statCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.danger }]}>-{spent}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('finance.spent')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>${expensesTotalUsd.toFixed(0)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('finance.expenses')}</Text>
          </View>
          <View style={[styles.statCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{rewardsInPeriod.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('finance.rewardsCount')}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('finance.recentOps')}</Text>
        {recentOps.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('finance.emptyOps')}</Text>
        ) : (
          recentOps.map((op) => (
            <View key={op.id} style={[styles.opRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.opTitle, { color: colors.text }]} numberOfLines={1}>
                {op.title}
              </Text>
              <Text style={[styles.opPoints, { color: op.points >= 0 ? colors.success : colors.danger }]}>
                {op.points >= 0 ? '+' : ''}
                {op.points}
              </Text>
            </View>
          ))
        )}

        <PrimaryButton label={t('finance.historyButton')} onPress={goToHistory} variant="outline" style={styles.historyButton} />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  balanceCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  opTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  opPoints: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  historyButton: {
    marginTop: spacing.md,
  },
});
