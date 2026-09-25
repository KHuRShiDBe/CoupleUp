import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { usePlanning } from '../../store/PlanningContext';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

export const CalendarBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const interaction = useCoupleInteraction();
  const planning = usePlanning();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const markedDays = useMemo(() => {
    const set = new Set<number>();
    interaction.importantDates.forEach((d) => {
      const target = new Date(d.date);
      if (target.getMonth() === month) set.add(target.getDate());
    });
    return set;
  }, [interaction.importantDates, month]);

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    // Monday-first grid.
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const today = now.getDate();

  const upcomingDates = [...interaction.importantDates].sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    return new Date(year, da.getMonth(), da.getDate()).getTime() - new Date(year, db.getMonth(), db.getDate()).getTime();
  });
  const activePromises = planning.promises.filter((p) => p.status === 'active');
  const planItems = planning.planItems.filter((p) => !p.done && (p.bucket === 'today' || p.bucket === 'week'));
  const savedDates = planning.dateIdeaSaves;

  const hasAnyAgenda = upcomingDates.length > 0 || activePromises.length > 0 || planItems.length > 0 || savedDates.length > 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
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
            {grid.map((day, i) => (
              <View key={i} style={styles.cell}>
                {day !== null && (
                  <View
                    style={[
                      styles.dayCircle,
                      day === today ? { backgroundColor: colors.primary } : null,
                    ]}
                  >
                    <Text style={[styles.dayText, { color: day === today ? colors.textOnPrimary : colors.text }]}>{day}</Text>
                    {markedDays.has(day) && <View style={[styles.dayDot, { backgroundColor: day === today ? colors.textOnPrimary : colors.primary }]} />}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {!hasAnyAgenda ? (
          <EmptyState icon="notification" title={t('calendar.emptyTitle')} description={t('calendar.emptyDescription')} />
        ) : (
          <>
            {upcomingDates.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('importantDates.title')}</Text>
                {upcomingDates.map((d) => (
                  <View key={d.id} style={[styles.agendaRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.agendaText, { color: colors.text }]}>{d.label}</Text>
                    <Text style={[styles.agendaMeta, { color: colors.textSecondary }]}>{new Date(d.date).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            )}

            {activePromises.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('promises.title')}</Text>
                {activePromises.map((p) => (
                  <View key={p.id} style={[styles.agendaRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.agendaText, { color: colors.text }]}>{p.title}</Text>
                  </View>
                ))}
              </View>
            )}

            {planItems.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('planBoard.title')}</Text>
                {planItems.map((p) => (
                  <View key={p.id} style={[styles.agendaRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.agendaText, { color: colors.text }]}>{p.title}</Text>
                    <Text style={[styles.agendaMeta, { color: colors.textSecondary }]}>{t(`planBoard.bucket_${p.bucket}`)}</Text>
                  </View>
                ))}
              </View>
            )}

            {savedDates.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dateIdeas.tabSaved')}</Text>
                {savedDates.map((s) => (
                  <View key={s.id} style={[styles.agendaRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.agendaText, { color: colors.text }]}>{s.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
  );
};

export const CalendarScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('calendar.title')} onBack={() => navigation.goBack()} />
      <CalendarBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  monthLabel: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  agendaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  agendaText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  agendaMeta: {
    fontSize: fontSize.xs,
  },
});
