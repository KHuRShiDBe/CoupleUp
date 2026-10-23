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
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useNotifications } from '../../store/NotificationsContext';
import { useTranslation } from '../../localization/useTranslation';
import { isWithinDays } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleStats'>;

const FAIRNESS_WINDOW_DAYS = 7;
// Within this band of the 50/50 split, activity reads as "balanced" -- wide
// enough that ordinary day-to-day variation doesn't flip the message.
const BALANCE_BAND = 0.15;

export const CoupleStatsBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const interaction = useCoupleInteraction();
  const { notifications } = useNotifications();

  const daysTogether = sync.couple ? Math.floor((Date.now() - new Date(sync.couple.created_at).getTime()) / 86400000) : 0;
  const complimentsCount = sync.actionsList.filter((a) => a.type === 'compliment').length;
  const actionsCount = sync.actionsList.filter((a) => a.type === 'action').length;
  // Real `tasks`/`goals` tables (Package #2) instead of the legacy local
  // completedTasks/sharedGoals, which nothing populates anymore -- this used
  // to independently re-derive the same stats useCoupleStats already fixed,
  // showing different (stuck-at-zero) numbers on this screen than elsewhere.
  const tasksCompletedCount = sync.tasks.filter((t2) => t2.status === 'completed').length;
  const goalsClosedCount = notifications.filter((n) => n.type === 'goal_completed').length;
  const questionDatesBothAnswered = useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    interaction.dailyAnswers.forEach((a) => {
      const set = byDate.get(a.question_date) ?? new Set<string>();
      set.add(a.user_id);
      byDate.set(a.question_date, set);
    });
    return [...byDate.values()].filter((set) => set.size >= 2).length;
  }, [interaction.dailyAnswers]);

  const fairness = useMemo(() => {
    const recent = sync.actionsList.filter((a) => isWithinDays(a.created_at, FAIRNESS_WINDOW_DAYS) && a.points > 0);
    const mine = recent.filter((a) => a.recipient_id === sync.userId).reduce((s, a) => s + a.points, 0);
    const partnerPoints = recent.filter((a) => a.recipient_id === sync.partner?.id).reduce((s, a) => s + a.points, 0);
    const total = mine + partnerPoints;
    if (total === 0) return 'noData' as const;
    const ratio = mine / total;
    return Math.abs(ratio - 0.5) <= BALANCE_BAND ? ('balanced' as const) : ('uneven' as const);
  }, [sync.actionsList, sync.userId, sync.partner?.id]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.statsRow}>
        <StatCard label={t('coupleStats.daysTogether')} value={daysTogether} emphasis />
        <StatCard label={t('coupleStats.actions')} value={actionsCount} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label={t('coupleStats.compliments')} value={complimentsCount} />
        <StatCard label={t('coupleStats.tasksCompleted')} value={tasksCompletedCount} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label={t('coupleStats.goalsClosed')} value={goalsClosedCount} />
        <StatCard label={t('coupleStats.questionsAnswered')} value={questionDatesBothAnswered} />
      </View>

      <View style={[styles.fairnessCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.fairnessText, { color: colors.text }]}>
          {fairness === 'balanced'
            ? t('coupleStats.fairnessBalanced')
            : fairness === 'uneven'
              ? t('coupleStats.fairnessUneven')
              : t('coupleStats.fairnessNoData')}
        </Text>
      </View>
    </ScrollView>
  );
};

export const CoupleStatsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('coupleStats.title')} onBack={() => navigation.goBack()} />
      <CoupleStatsBody />
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
  fairnessCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  fairnessText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
