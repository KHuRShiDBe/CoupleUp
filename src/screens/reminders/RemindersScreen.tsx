import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useReminders } from '../../store/RemindersContext';
import { ReminderRule, ReminderTargetType } from '../../types/database';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

const TARGET_TYPES: ReminderTargetType[] = ['promise', 'habit', 'important_date', 'goal', 'task', 'shopping_item'];
const RULES: ReminderRule[] = ['today', 'tomorrow', 'in_3_days', 'specific_date', 'weekly'];

export const RemindersScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { configured } = useAuth();
  const { reminders, loading, error, addReminder, setReminderActive, removeReminder, refresh } = useReminders();

  const [title, setTitle] = useState('');
  const [targetType, setTargetType] = useState<ReminderTargetType>('task');
  const [rule, setRule] = useState<ReminderRule>('today');
  const [specificDate, setSpecificDate] = useState('');

  const canSubmit = title.trim().length > 0 && (rule !== 'specific_date' || /^\d{4}-\d{2}-\d{2}$/.test(specificDate));

  const handleAdd = async () => {
    if (!canSubmit) return;
    haptics.confirm();
    await addReminder({ title: title.trim(), targetType, rule, specificDate: rule === 'specific_date' ? specificDate : undefined });
    setTitle('');
    setSpecificDate('');
  };

  if (!configured) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('reminders.title')} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('reminders.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('reminders.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('reminders.targetLabel')}</Text>
          <View style={styles.chipRow}>
            {TARGET_TYPES.map((tt) => (
              <Pressable
                key={tt}
                onPress={() => setTargetType(tt)}
                style={[
                  styles.chip,
                  {
                    borderColor: targetType === tt ? colors.primary : colors.border,
                    backgroundColor: targetType === tt ? colors.background : colors.card,
                    borderWidth: targetType === tt ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`reminders.target_${tt}`)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('reminders.ruleLabel')}</Text>
          <View style={styles.chipRow}>
            {RULES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRule(r)}
                style={[
                  styles.chip,
                  {
                    borderColor: rule === r ? colors.primary : colors.border,
                    backgroundColor: rule === r ? colors.background : colors.card,
                    borderWidth: rule === r ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`reminders.rule_${r}`)}</Text>
              </Pressable>
            ))}
          </View>

          {rule === 'specific_date' && (
            <TextInput
              value={specificDate}
              onChangeText={setSpecificDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
          )}

          <PrimaryButton label={t('reminders.addButton')} onPress={handleAdd} disabled={!canSubmit} />
        </View>

        {loading && reminders.length === 0 && <LoadingState />}
        {!loading && error && reminders.length === 0 && <ErrorState message={error} onRetry={refresh} />}
        {!loading && !error && reminders.length === 0 && (
          <EmptyState icon="notification" title={t('reminders.emptyTitle')} description={t('reminders.emptyDescription')} />
        )}

        {reminders.map((r) => (
          <View key={r.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border, opacity: r.is_active ? 1 : 0.5 }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {r.title}
              </Text>
              <Pressable onPress={() => removeReminder(r.id)} hitSlop={8}>
                <Text style={[styles.deleteText, { color: colors.danger }]}>{t('reminders.delete')}</Text>
              </Pressable>
            </View>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {t(`reminders.target_${r.target_type}`)} · {t(`reminders.rule_${r.rule}`)}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {new Date(r.remind_at).toLocaleString()}
            </Text>
            <Pressable onPress={() => setReminderActive(r.id, !r.is_active)} style={styles.toggleRow}>
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {r.is_active ? t('reminders.pause') : t('reminders.resume')}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
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
  label: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
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
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  deleteText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  toggleRow: {
    marginTop: spacing.sm,
  },
  toggleText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
