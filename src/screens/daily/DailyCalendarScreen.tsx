import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useDailyActions } from '../../store/DailyActionsContext';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { getDailyActionsFor, todayIso } from '../../constants/dailyActions';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyCalendar'>;

type DayStatus = 'full' | 'partial' | 'none' | 'future';

export const DailyCalendarBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const daily = useDailyActions();
  const coupleId = sync.couple?.id ?? null;

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayIso());

  const viewDate = new Date();
  viewDate.setDate(1);
  viewDate.setMonth(viewDate.getMonth() + monthOffset);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayStr = todayIso();

  const dateIsoFor = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const statusFor = (day: number): DayStatus => {
    if (!coupleId) return 'none';
    const iso = dateIsoFor(day);
    if (iso > todayStr) return 'future';
    const scheduled = getDailyActionsFor(coupleId, iso);
    const completedIds = new Set(daily.completions.filter((c) => c.action_date === iso).map((c) => c.action_id));
    const doneCount = scheduled.filter((a) => completedIds.has(a.id)).length;
    if (doneCount === 0) return 'none';
    if (doneCount === scheduled.length) return 'full';
    return 'partial';
  };

  const dotColorFor = (status: DayStatus): string | null => {
    if (status === 'full') return colors.success;
    if (status === 'partial') return colors.primary;
    return null;
  };

  const selectedDetail = useMemo(() => {
    if (!selectedDate || !coupleId) return null;
    const scheduled = getDailyActionsFor(coupleId, selectedDate);
    const completions = daily.completions.filter((c) => c.action_date === selectedDate);
    const completedIds = new Set(completions.map((c) => c.action_id));
    const pointsEarned = completions.reduce((s, c) => s + c.points, 0);
    const prog = daily.progress.find((p) => p.progress_date === selectedDate);
    return {
      scheduled,
      completedIds,
      pointsEarned,
      bonusClaimed: prog?.bonus_claimed ?? false,
      wheelSpun: prog?.wheel_spun ?? false,
      wheelReward: prog?.wheel_reward_points ?? null,
    };
  }, [selectedDate, coupleId, daily.completions, daily.progress]);

  if (!auth.configured) {
    return <ErrorState message={t('activityCenter.notConfigured')} />;
  }

  if (daily.loading && daily.completions.length === 0) {
    return <LoadingState lines={4} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => setMonthOffset((m) => m - 1)} hitSlop={10}>
              <Text style={[styles.monthArrow, { color: colors.primary }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
            <Pressable onPress={() => setMonthOffset((m) => Math.min(0, m + 1))} hitSlop={10} disabled={monthOffset >= 0}>
              <Text style={[styles.monthArrow, { color: monthOffset >= 0 ? colors.border : colors.primary }]}>›</Text>
            </Pressable>
          </View>

          <View style={[styles.gridCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.weekRow}>
              {t('calendar.weekdays')
                .split(',')
                .map((w, i) => (
                  <Text key={i} style={[styles.weekday, { color: colors.textSecondary }]}>
                    {w}
                  </Text>
                ))}
            </View>
            <View style={styles.grid}>
              {grid.map((day, i) => {
                if (day === null) return <View key={i} style={styles.cell} />;
                const iso = dateIsoFor(day);
                const status = statusFor(day);
                const isToday = iso === todayStr;
                const isSelected = iso === selectedDate;
                const dot = dotColorFor(status);
                return (
                  <View key={i} style={styles.cell}>
                    <Pressable
                      onPress={() => setSelectedDate(iso)}
                      style={[
                        styles.dayCircle,
                        isSelected && { backgroundColor: colors.primary },
                        !isSelected && isToday && { borderWidth: 2, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.dayText, { color: isSelected ? colors.textOnPrimary : colors.text }]}>{day}</Text>
                      {dot && !isSelected && <View style={[styles.dayDot, { backgroundColor: dot }]} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('dailyCalendar.legendFull')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('dailyCalendar.legendPartial')}</Text>
              </View>
            </View>
          </View>

          {selectedDetail && (
            <View style={[styles.detailCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.detailDate, { color: colors.text }]}>
                {selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : ''}
              </Text>

              {selectedDetail.scheduled.length === 0 ? (
                <Text style={[styles.detailEmpty, { color: colors.textSecondary }]}>{t('dailyCalendar.noSchedule')}</Text>
              ) : (
                <>
                  <Text style={[styles.detailSection, { color: colors.textSecondary }]}>{t('dailyCalendar.scheduled')}</Text>
                  {selectedDetail.scheduled.map((a) => {
                    const done = selectedDetail.completedIds.has(a.id);
                    return (
                      <View key={a.id} style={styles.detailRow}>
                        <Text style={[styles.detailRowText, { color: done ? colors.success : colors.textSecondary }]}>
                          {done ? '✓ ' : '· '}
                          {t(`dailyActions.item_${a.id}` as TranslationKey)}
                        </Text>
                        <Text style={[styles.detailRowPoints, { color: colors.textSecondary }]}>+{a.points}</Text>
                      </View>
                    );
                  })}

                  <View style={[styles.detailSummary, { borderTopColor: colors.border }]}>
                    <Text style={[styles.detailSummaryText, { color: colors.text }]}>
                      {t('dailyCalendar.earnedToday', { points: selectedDetail.pointsEarned })}
                    </Text>
                    <Text style={[styles.detailSummaryText, { color: colors.textSecondary }]}>
                      {t('dailyCalendar.bonus')}: {selectedDetail.bonusClaimed ? t('dailyCalendar.yes') : t('dailyCalendar.no')}
                    </Text>
                    <Text style={[styles.detailSummaryText, { color: colors.textSecondary }]}>
                      {t('dailyCalendar.wheel')}:{' '}
                      {selectedDetail.wheelSpun
                        ? `${t('dailyCalendar.yes')} (+${selectedDetail.wheelReward ?? 0})`
                        : t('dailyCalendar.no')}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
    </ScrollView>
  );
};

export const DailyCalendarScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('dailyCalendar.title')} onBack={() => navigation.goBack()} />
      <DailyCalendarBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  monthArrow: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
  },
  monthLabel: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  gridCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  dayDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.xs,
  },
  detailCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  detailDate: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  detailEmpty: {
    fontSize: fontSize.sm,
  },
  detailSection: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  detailRowText: {
    fontSize: fontSize.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  detailRowPoints: {
    fontSize: fontSize.xs,
  },
  detailSummary: {
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  detailSummaryText: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
});
