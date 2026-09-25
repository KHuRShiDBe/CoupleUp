import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { StatCard } from '../../components/cards/StatCard';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../../store/AuthContext';
import { useAppStore } from '../../store/AppContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useCoupleStats } from '../../store/useCoupleStats';
import { useTranslation } from '../../localization/useTranslation';
import { daysUntilNextOccurrence } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyDigest'>;

export const DailyDigestBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { configured } = useAuth();
  const { tasks } = useAppStore();
  const sync = useCoupleSync();
  const budget = useBudget();
  const interaction = useCoupleInteraction();
  const stats = useCoupleStats();

  const summary = useMemo(() => {
    const pendingRewardRequests = sync.rewardRequests.filter((r) => r.status === 'pending').length;
    const pendingPurchaseRequests = budget.purchaseRequests.filter((r) => r.status === 'pending').length;
    const importantDatesToday = interaction.importantDates.filter((d) => daysUntilNextOccurrence(d.date) === 0).length;
    return {
      tasksActive: tasks.length,
      requests: pendingRewardRequests + pendingPurchaseRequests,
      importantDatesToday,
      streak: stats.currentStreak,
      balance: sync.couple?.points ?? 0,
    };
  }, [tasks, sync.rewardRequests, budget.purchaseRequests, interaction.importantDates, stats.currentStreak, sync.couple?.points]);

  if (!configured) {
    return <ErrorState message={t('activityCenter.notConfigured')} />;
  }

  // Avoid a "false zero" flash: while the underlying contexts are still on
  // their first load, show a skeleton instead of stat cards that briefly
  // read 0/0/0 as if that were real, already-loaded data.
  const initialLoading = sync.loading || budget.loading || interaction.loading;

  if (initialLoading) {
    return <LoadingState lines={4} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('dailyDigest.subtitle')}</Text>

      <View style={styles.statsRow}>
        <StatCard label={t('dailyDigest.tasks')} value={summary.tasksActive} emphasis />
        <StatCard label={t('dailyDigest.requests')} value={summary.requests} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label={t('dailyDigest.importantDates')} value={summary.importantDatesToday} />
        <StatCard label={t('dailyDigest.messages')} value={0} />
      </View>

      <View style={[styles.bigCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.bigLabel, { color: colors.textSecondary }]}>{t('dailyDigest.streak')}</Text>
        <Text style={[styles.bigValue, { color: colors.text }]}>
          {summary.streak > 0 ? t('home.streak', { count: summary.streak }) : t('home.streakEmpty')}
        </Text>
      </View>

      <View style={[styles.bigCard, shadow.soft, { backgroundColor: colors.primary }]}>
        <Text style={[styles.bigLabel, { color: colors.textOnPrimary }]}>{t('dailyDigest.balance')}</Text>
        <Text style={[styles.bigValue, { color: colors.textOnPrimary }]}>{summary.balance}</Text>
      </View>

      <Text style={[styles.note, { color: colors.textSecondary }]}>{t('dailyDigest.messagesNote')}</Text>
    </ScrollView>
  );
};

export const DailyDigestScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('dailyDigest.title')} onBack={() => navigation.goBack()} />
      <DailyDigestBody />
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
  note: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
