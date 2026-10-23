import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { FilterTabs } from '../../components/common/FilterTabs';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { isThisMonth, isWithinDays } from '../../utils/date';
import { formatBond } from '../../utils/bond';
import { BUDGET_CATEGORIES } from '../../constants/budgetCategories';
import { BudgetCategory } from '../../types/database';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseHistory'>;
type RangeFilter = 'today' | 'week' | 'month' | 'all';
type PayerFilter = 'all' | 'me' | 'partner';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const ExpenseHistoryBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const bond = useBond();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('food');
  const [paidByMe, setPaidByMe] = useState(true);
  const [note, setNote] = useState('');

  const [range, setRange] = useState<RangeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | BudgetCategory>('all');
  const [payerFilter, setPayerFilter] = useState<PayerFilter>('all');

  const myId = auth.session?.user?.id;
  const nameFor = (userId: string) => (userId === myId ? t('promises.me') : sync.partner?.name ?? t('promises.partner'));

  const handleAdd = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(value) || value <= 0 || !myId) return;
    haptics.confirm();
    const paidBy = paidByMe ? myId : sync.partner?.id;
    if (!paidBy) return;
    budget.addExpense({ title: title.trim(), amountUsd: value, category, paidBy, expenseDate: todayIso(), note: note.trim() || undefined });
    setTitle('');
    setAmount('');
    setNote('');
  };

  const filtered = useMemo(() => {
    return budget.expenses.filter((e) => {
      if (range === 'today' && e.expense_date !== todayIso()) return false;
      if (range === 'week' && !isWithinDays(e.expense_date, 7)) return false;
      if (range === 'month' && !isThisMonth(e.expense_date)) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (payerFilter === 'me' && e.paid_by !== myId) return false;
      if (payerFilter === 'partner' && e.paid_by === myId) return false;
      return true;
    });
  }, [budget.expenses, range, categoryFilter, payerFilter, myId]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('expenses.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
            placeholder={t('expenses.amountPlaceholder')}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          {!!amount && Number.isFinite(parseFloat(amount.replace(',', '.'))) && (
            <Text style={[styles.computed, { color: colors.primary }]}>
              ≈ {formatBond(bond.toBond(parseFloat(amount.replace(',', '.'))))} BOND · ≈{' '}
              {Math.round(bond.toPoints(parseFloat(amount.replace(',', '.'))))} {t('bond.points')}
            </Text>
          )}
          <View style={styles.chipRow}>
            {BUDGET_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.chip,
                  {
                    borderColor: category === c ? colors.primary : colors.border,
                    backgroundColor: category === c ? colors.background : colors.card,
                    borderWidth: category === c ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`budget.category_${c}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setPaidByMe(true)}
              style={[styles.chip, { borderColor: paidByMe ? colors.primary : colors.border, borderWidth: paidByMe ? 2 : 1 }]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>{t('promises.me')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setPaidByMe(false)}
              style={[styles.chip, { borderColor: !paidByMe ? colors.primary : colors.border, borderWidth: !paidByMe ? 2 : 1 }]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>{sync.partner?.name ?? t('promises.partner')}</Text>
            </Pressable>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('expenses.notePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <PrimaryButton label={t('expenses.addButton')} onPress={handleAdd} disabled={!title.trim() || !amount.trim()} />
        </View>

        <FilterTabs
          options={[
            { key: 'all', label: t('expenses.filterAll') },
            { key: 'today', label: t('expenses.filterToday') },
            { key: 'week', label: t('expenses.filterWeek') },
            { key: 'month', label: t('expenses.filterMonth') },
          ]}
          value={range}
          onChange={(key) => setRange(key as RangeFilter)}
        />
        <FilterTabs
          options={[
            { key: 'all', label: t('expenses.filterAllPayers') },
            { key: 'me', label: t('promises.me') },
            { key: 'partner', label: sync.partner?.name ?? t('promises.partner') },
          ]}
          value={payerFilter}
          onChange={(key) => setPayerFilter(key as PayerFilter)}
        />

        {filtered.length === 0 ? (
          <EmptyState icon="history" title={t('expenses.emptyTitle')} description={t('expenses.emptyDescription')} />
        ) : (
          filtered.map((e) => (
            <View key={e.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{e.title}</Text>
                <Text style={[styles.cardAmount, { color: colors.primary }]}>${e.amount_usd.toFixed(2)}</Text>
              </View>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {nameFor(e.paid_by)} · {t(`budget.category_${e.category}`)} · {new Date(e.expense_date).toLocaleDateString()}
              </Text>
              {!!e.note && <Text style={[styles.cardNote, { color: colors.textSecondary }]}>{e.note}</Text>}
            </View>
          ))
        )}
      </ScrollView>
  );
};

export const ExpenseHistoryScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('expenses.title')} onBack={() => navigation.goBack()} />
      <ExpenseHistoryBody />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  form: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  computed: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: radius.round,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  cardAmount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cardNote: {
    fontSize: fontSize.xs,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
