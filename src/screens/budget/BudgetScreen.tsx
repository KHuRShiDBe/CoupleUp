import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useBudget } from '../../store/BudgetContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { isThisMonth } from '../../utils/date';
import { formatBond, formatUsd } from '../../utils/bond';
import { BUDGET_CATEGORIES } from '../../constants/budgetCategories';
import { BudgetCategory } from '../../types/database';

type Props = NativeStackScreenProps<RootStackParamList, 'Budget'>;

export const BudgetBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const budget = useBudget();
  const bond = useBond();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const monthExpenses = useMemo(() => budget.expenses.filter((e) => isThisMonth(e.expense_date)), [budget.expenses]);

  const rows = useMemo(
    () =>
      BUDGET_CATEGORIES.map((cat) => {
        const planned = budget.budgets.find((b) => b.category === cat)?.planned_usd ?? 0;
        const spent = monthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount_usd, 0);
        return { category: cat, planned, spent, remaining: planned - spent };
      }),
    [budget.budgets, monthExpenses],
  );

  const totals = rows.reduce(
    (acc, r) => ({ planned: acc.planned + r.planned, spent: acc.spent + r.spent, remaining: acc.remaining + r.remaining }),
    { planned: 0, spent: 0, remaining: 0 },
  );

  const handleSave = (category: BudgetCategory) => {
    const raw = drafts[category];
    const value = raw ? parseFloat(raw.replace(',', '.')) : NaN;
    if (!Number.isFinite(value) || value < 0) return;
    haptics.confirm();
    budget.setBudget(category, value);
    setDrafts((prev) => ({ ...prev, [category]: '' }));
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.summaryCard, shadow.soft, { backgroundColor: colors.primary }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.textOnPrimary }]}>${totals.planned.toFixed(0)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textOnPrimary }]}>{t('budget.planned')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.textOnPrimary }]}>${totals.spent.toFixed(0)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textOnPrimary }]}>{t('budget.spent')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.textOnPrimary }]}>${totals.remaining.toFixed(0)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textOnPrimary }]}>{t('budget.remaining')}</Text>
            </View>
          </View>
          <Text style={[styles.summaryBond, { color: colors.textOnPrimary }]}>
            ≈ {formatBond(totals.planned)} BOND · ≈ {Math.round(bond.toPoints(totals.planned))} {t('bond.points')}
          </Text>
        </View>

        {rows.map((row) => (
          <View key={row.category} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t(`budget.category_${row.category}`)}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: row.spent > row.planned && row.planned > 0 ? colors.danger : colors.primary,
                    width: `${row.planned > 0 ? Math.min(100, (row.spent / row.planned) * 100) : 0}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              ${row.spent.toFixed(0)} / ${row.planned.toFixed(0)} · {t('budget.remaining')}: ${row.remaining.toFixed(0)}
            </Text>
            <View style={styles.editRow}>
              <TextInput
                value={drafts[row.category] ?? ''}
                onChangeText={(v) => setDrafts((prev) => ({ ...prev, [row.category]: v.replace(/[^0-9.,]/g, '') }))}
                placeholder={t('budget.plannedPlaceholder')}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <PrimaryButton label={t('budget.save')} onPress={() => handleSave(row.category)} style={styles.saveButton} />
            </View>
          </View>
        ))}
      </ScrollView>
  );
};

export const BudgetScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('budget.title')} onBack={() => navigation.goBack()} />
      <BudgetBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    opacity: 0.9,
    marginTop: 2,
  },
  summaryBond: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
    opacity: 0.9,
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
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
  },
  saveButton: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
});
