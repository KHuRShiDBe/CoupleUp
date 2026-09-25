import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { formatBond, formatUsd } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedGoals'>;

const ADD_AMOUNT = 50;
const TAP_COOLDOWN_MS = 500;

export const SharedGoalsBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const bond = useBond();
  const lastTapAt = useRef<Record<string, number>>({});

  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('500');
  const [creating, setCreating] = useState(false);

  const handleAdd = (goalId: string) => {
    const now = Date.now();
    if (now - (lastTapAt.current[goalId] ?? 0) < TAP_COOLDOWN_MS) return;
    lastTapAt.current[goalId] = now;
    sync.addToGoal(goalId, ADD_AMOUNT);
  };

  const handleCreate = async () => {
    const target = Math.abs(parseInt(newTarget, 10) || 0);
    if (!newTitle.trim() || target <= 0 || creating) return;
    setCreating(true);
    try {
      await sync.createGoal({ title: newTitle.trim(), targetPoints: target });
      setNewTitle('');
      setNewTarget('500');
    } finally {
      setCreating(false);
    }
  };

  if (!auth.configured) {
    return <ErrorState message={t('activityCenter.notConfigured')} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {sync.loading && sync.goals.length === 0 ? (
          <LoadingState />
        ) : (
          <>
            {!!sync.error && <BackendStatusBanner message={sync.error} onRetry={sync.clearError} />}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('goals.availablePoints', { points: sync.myStats.balance })}
            </Text>

            <View style={[styles.createCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={t('goals.namePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <TextInput
                value={newTarget}
                onChangeText={(v) => setNewTarget(v.replace(/[^0-9]/g, ''))}
                placeholder={t('goals.targetPlaceholder')}
                keyboardType="number-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <PrimaryButton
                label={t('goals.createButton')}
                onPress={handleCreate}
                disabled={!newTitle.trim() || creating}
                loading={creating}
              />
            </View>

            {sync.goals.length === 0 && (
              <EmptyState icon="goal" title={t('goals.emptyTitle')} description={t('goals.emptyDescription')} />
            )}

            {sync.goals.map((goal) => {
              const remaining = Math.max(0, goal.target_points - goal.current_points);
              const progress = Math.min(100, (goal.current_points / goal.target_points) * 100);
              const reached = remaining === 0;
              const canAdd = !reached && sync.myStats.balance >= 1;

              return (
                <View key={goal.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
                      <IconImage name="goal" size={24} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{goal.title}</Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {goal.current_points} / {goal.target_points} {t('goals.pointsSuffix')}
                      </Text>
                      <Text style={[styles.cardMetaBond, { color: colors.textSecondary }]}>
                        ≈ {formatBond(bond.toBond(goal.current_points))} / {formatBond(bond.toBond(goal.target_points))} BOND ·
                        ≈ {formatUsd(bond.toBond(goal.current_points))} / {formatUsd(bond.toBond(goal.target_points))}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
                  </View>

                  <Text style={[styles.remaining, { color: colors.textSecondary }]}>
                    {reached ? t('goals.reached') : t('goals.remaining', { points: remaining })}
                  </Text>

                  <PrimaryButton
                    label={t('goals.addButton', { amount: ADD_AMOUNT })}
                    onPress={() => handleAdd(goal.id)}
                    disabled={!canAdd}
                    style={styles.cardButton}
                  />
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
  );
};

export const SharedGoalsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('goals.title')} onBack={() => navigation.goBack()} />
      <SharedGoalsBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  createCard: {
    borderRadius: radius.lg,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cardMetaBond: {
    fontSize: 10,
    marginTop: 2,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
  },
  remaining: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  cardButton: {
    height: 44,
  },
});
