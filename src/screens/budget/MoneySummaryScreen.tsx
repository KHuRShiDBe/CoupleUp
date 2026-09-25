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
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { isThisMonth } from '../../utils/date';
import { formatBond } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'MoneySummary'>;

export const MoneySummaryBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const bond = useBond();

  const myId = auth.session?.user?.id;
  const nameFor = (userId: string) => (userId === myId ? t('promises.me') : sync.partner?.name ?? t('promises.partner'));

  const summary = useMemo(() => {
    const monthExpenses = budget.expenses.filter((e) => isThisMonth(e.expense_date));
    const total = monthExpenses.reduce((s, e) => s + e.amount_usd, 0);
    const byPayer = new Map<string, number>();
    monthExpenses.forEach((e) => byPayer.set(e.paid_by, (byPayer.get(e.paid_by) ?? 0) + e.amount_usd));
    const byCategory = new Map<string, number>();
    monthExpenses.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_usd));
    let biggestCategory: string | null = null;
    let biggestAmount = 0;
    byCategory.forEach((amount, cat) => {
      if (amount > biggestAmount) {
        biggestAmount = amount;
        biggestCategory = cat;
      }
    });
    const savedTotal = budget.savingsContributions.reduce((s, c) => s + c.amount_usd, 0);

    return { total, byPayer, biggestCategory, biggestAmount, savedTotal, hasData: monthExpenses.length > 0 || budget.savingsGoals.length > 0 };
  }, [budget.expenses, budget.savingsContributions, budget.savingsGoals]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!summary.hasData ? (
          <EmptyState icon="history" title={t('moneySummary.emptyTitle')} description={t('moneySummary.emptyDescription')} />
        ) : (
          <>
            <View style={[styles.totalCard, shadow.soft, { backgroundColor: colors.primary }]}>
              <Text style={[styles.totalLabel, { color: colors.textOnPrimary }]}>{t('moneySummary.totalSpent')}</Text>
              <Text style={[styles.totalValue, { color: colors.textOnPrimary }]}>${summary.total.toFixed(0)}</Text>
              <Text style={[styles.totalBond, { color: colors.textOnPrimary }]}>
                ≈ {formatBond(bond.toBond(summary.total))} BOND · ≈ {Math.round(bond.toPoints(summary.total))} {t('bond.points')}
              </Text>
            </View>

            <View style={styles.statsRow}>
              {[...summary.byPayer.entries()].map(([userId, amount]) => (
                <StatCard key={userId} label={nameFor(userId)} value={Math.round(amount)} />
              ))}
            </View>

            {summary.biggestCategory && (
              <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('moneySummary.biggestCategory')}</Text>
                <Text style={[styles.cardValue, { color: colors.text }]}>
                  {t(`budget.category_${summary.biggestCategory}`)} — ${summary.biggestAmount.toFixed(0)}
                </Text>
              </View>
            )}

            <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('moneySummary.savedTotal')}</Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                ${summary.savedTotal.toFixed(0)} · ≈ {formatBond(bond.toBond(summary.savedTotal))} BOND
              </Text>
            </View>

            {budget.savingsGoals.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('savings.title')}</Text>
                {budget.savingsGoals.map((goal) => {
                  const saved = budget.savingsContributions.filter((c) => c.goal_id === goal.id).reduce((s, c) => s + c.amount_usd, 0);
                  const progress = Math.min(100, (saved / goal.target_usd) * 100);
                  return (
                    <View key={goal.id} style={[styles.goalRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
                      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
                      </View>
                      <Text style={[styles.goalMeta, { color: colors.textSecondary }]}>
                        ${saved.toFixed(0)} / ${goal.target_usd.toFixed(0)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
  );
};

export const MoneySummaryScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('moneySummary.title')} onBack={() => navigation.goBack()} />
      <MoneySummaryBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  totalCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.sm,
    opacity: 0.9,
  },
  totalValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  totalBond: {
    fontSize: fontSize.xs,
    opacity: 0.85,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  cardValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  goalRow: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
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
  goalMeta: {
    fontSize: fontSize.xs,
  },
});
