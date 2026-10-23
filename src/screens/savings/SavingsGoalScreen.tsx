import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { formatBond } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsGoal'>;

export const SavingsGoalBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const bond = useBond();

  const [title, setTitle] = useState('');
  const [targetUsd, setTargetUsd] = useState('');
  const [contributionDrafts, setContributionDrafts] = useState<Record<string, string>>({});

  const myId = auth.session?.user?.id;
  const nameFor = (userId: string) => (userId === myId ? t('promises.me') : sync.partner?.name ?? t('promises.partner'));

  const handleAddGoal = () => {
    const target = parseFloat(targetUsd.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(target) || target <= 0) return;
    haptics.confirm();
    budget.addSavingsGoal(title.trim(), target);
    setTitle('');
    setTargetUsd('');
  };

  const handleContribute = (goalId: string) => {
    const raw = contributionDrafts[goalId];
    const amount = raw ? parseFloat(raw.replace(',', '.')) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) return;
    haptics.confirm();
    budget.addSavingsContribution(goalId, amount);
    setContributionDrafts((prev) => ({ ...prev, [goalId]: '' }));
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('savings.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <TextInput
            value={targetUsd}
            onChangeText={(v) => setTargetUsd(v.replace(/[^0-9.,]/g, ''))}
            placeholder={t('savings.targetPlaceholder')}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <PrimaryButton label={t('savings.addButton')} onPress={handleAddGoal} disabled={!title.trim() || !targetUsd.trim()} />
        </View>

        {budget.savingsGoals.length === 0 ? (
          <EmptyState icon="goal" title={t('savings.emptyTitle')} description={t('savings.emptyDescription')} />
        ) : (
          budget.savingsGoals.map((goal) => {
            const contributions = budget.savingsContributions.filter((c) => c.goal_id === goal.id);
            const byUser = new Map<string, number>();
            contributions.forEach((c) => byUser.set(c.user_id, (byUser.get(c.user_id) ?? 0) + c.amount_usd));
            const totalUsd = [...byUser.values()].reduce((s, v) => s + v, 0);
            const progress = Math.min(100, (totalUsd / goal.target_usd) * 100);
            const remaining = Math.max(0, goal.target_usd - totalUsd);

            return (
              <View key={goal.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{goal.title}</Text>
                <Text style={[styles.cardTarget, { color: colors.textSecondary }]}>
                  ${goal.target_usd.toFixed(0)} · ≈ {formatBond(goal.target_usd)} BOND · ≈{' '}
                  {Math.round(bond.toPoints(goal.target_usd))} {t('bond.points')}
                </Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
                </View>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  ${totalUsd.toFixed(0)} / ${goal.target_usd.toFixed(0)} · {t('savings.remaining')}: ${remaining.toFixed(0)}
                </Text>

                <View style={[styles.contributionsBox, { borderTopColor: colors.border }]}>
                  {[...byUser.entries()].map(([userId, amount]) => (
                    <View key={userId} style={styles.contributionRow}>
                      <Text style={[styles.contributionName, { color: colors.text }]}>{nameFor(userId)}</Text>
                      <Text style={[styles.contributionValue, { color: colors.textSecondary }]}>
                        ${amount.toFixed(0)} · {Math.round(bond.toPoints(amount))} {t('bond.points')}
                      </Text>
                    </View>
                  ))}
                  {byUser.size === 0 && (
                    <Text style={[styles.contributionValue, { color: colors.textSecondary }]}>{t('savings.noContributions')}</Text>
                  )}
                </View>

                <View style={styles.contributeRow}>
                  <TextInput
                    value={contributionDrafts[goal.id] ?? ''}
                    onChangeText={(v) => setContributionDrafts((prev) => ({ ...prev, [goal.id]: v.replace(/[^0-9.,]/g, '') }))}
                    placeholder={t('savings.contributePlaceholder')}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.contributeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  />
                  <PrimaryButton label={t('savings.contribute')} onPress={() => handleContribute(goal.id)} style={styles.contributeButton} />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
  );
};

export const SavingsGoalScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('savings.title')} onBack={() => navigation.goBack()} />
      <SavingsGoalBody />
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
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardTarget: {
    fontSize: fontSize.xs,
    marginTop: 2,
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
  },
  contributionsBox: {
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  contributionName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  contributionValue: {
    fontSize: fontSize.xs,
  },
  contributeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  contributeInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
  },
  contributeButton: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
});
