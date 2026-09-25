import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { IconImage } from '../../components/common/IconImage';
import { EmptyState } from '../../components/common/EmptyState';
import { usePlanning } from '../../store/PlanningContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { computeStreak } from '../../utils/streak';
import { HabitFrequency } from '../../types/database';
import { TaskAssignee } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Habits'>;

const FREQUENCIES: HabitFrequency[] = ['daily', 'weekly'];
const ASSIGNEES: TaskAssignee[] = ['me', 'partner', 'both'];

export const HabitsBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const planning = usePlanning();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [assignee, setAssignee] = useState<TaskAssignee>('both');

  const handleAdd = () => {
    if (!title.trim()) return;
    haptics.confirm();
    planning.addHabit({ title: title.trim(), description: description.trim() || undefined, frequency, assignee });
    setTitle('');
    setDescription('');
  };

  const handleLog = (habitId: string) => {
    haptics.success();
    planning.logHabit(habitId);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('habits.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('habits.descriptionPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <View style={styles.chipRow}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFrequency(f)}
                style={[
                  styles.chip,
                  {
                    borderColor: frequency === f ? colors.primary : colors.border,
                    backgroundColor: frequency === f ? colors.background : colors.card,
                    borderWidth: frequency === f ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`habits.frequency_${f}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipRow}>
            {ASSIGNEES.map((a) => (
              <Pressable
                key={a}
                onPress={() => setAssignee(a)}
                style={[
                  styles.chip,
                  {
                    borderColor: assignee === a ? colors.primary : colors.border,
                    backgroundColor: assignee === a ? colors.background : colors.card,
                    borderWidth: assignee === a ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`habits.assignee_${a}`)}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label={t('habits.addButton')} onPress={handleAdd} disabled={!title.trim()} />
        </View>

        {planning.habits.length === 0 ? (
          <EmptyState icon="goal" title={t('habits.emptyTitle')} description={t('habits.emptyDescription')} />
        ) : (
          planning.habits.map((habit) => {
            const dates = planning.habitLogs.filter((l) => l.habit_id === habit.id).map((l) => l.log_date);
            const streak = computeStreak(dates);
            const doneToday = dates.includes(new Date().toISOString().slice(0, 10));
            return (
              <View key={habit.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
                    <IconImage name="goal" size={22} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{habit.title}</Text>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                      {t(`habits.frequency_${habit.frequency}`)} · {t(`habits.assignee_${habit.assignee}`)}
                    </Text>
                  </View>
                </View>
                {!!habit.description && (
                  <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{habit.description}</Text>
                )}
                <View style={[styles.streakRow, { borderTopColor: colors.border }]}>
                  <View style={styles.streakItem}>
                    <Text style={[styles.streakValue, { color: colors.primary }]}>{streak.current}</Text>
                    <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>{t('habits.streakCurrent')}</Text>
                  </View>
                  <View style={styles.streakItem}>
                    <Text style={[styles.streakValue, { color: colors.text }]}>{streak.best}</Text>
                    <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>{t('habits.streakBest')}</Text>
                  </View>
                  <View style={styles.streakItem}>
                    <Text style={[styles.streakValue, { color: colors.text }]}>{streak.thisWeek}</Text>
                    <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>{t('habits.streakWeek')}</Text>
                  </View>
                </View>
                <PrimaryButton
                  label={doneToday ? t('habits.doneToday') : t('habits.markToday')}
                  onPress={() => handleLog(habit.id)}
                  disabled={doneToday}
                  variant={doneToday ? 'outline' : 'primary'}
                  style={styles.logButton}
                />
              </View>
            );
          })
        )}
      </ScrollView>
  );
};

export const HabitsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('habits.title')} onBack={() => navigation.goBack()} />
      <HabitsBody />
    </ScreenContainer>
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
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
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
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cardDescription: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  streakRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  logButton: {
    marginTop: spacing.md,
    height: 44,
  },
});
