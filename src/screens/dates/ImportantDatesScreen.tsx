import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { daysUntilNextOccurrence } from '../../utils/date';
import { ImportantDateType } from '../../types/database';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportantDates'>;

const TYPES: ImportantDateType[] = ['anniversary', 'met_day', 'wedding_day', 'partner_birthday', 'custom'];

export const ImportantDatesBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const interaction = useCoupleInteraction();
  const [type, setType] = useState<ImportantDateType>('anniversary');
  const [label, setLabel] = useState('');
  const [dateInput, setDateInput] = useState('');

  const typeLabel = (v: ImportantDateType) => t(`importantDates.type_${v}` as `importantDates.type_${ImportantDateType}`);

  const parsedDate = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return null;
    const d = new Date(dateInput);
    return Number.isNaN(d.getTime()) ? null : dateInput;
  }, [dateInput]);

  const sorted = useMemo(
    () => [...interaction.importantDates].sort((a, b) => daysUntilNextOccurrence(a.date) - daysUntilNextOccurrence(b.date)),
    [interaction.importantDates],
  );

  const handleAdd = () => {
    if (!label.trim() || !parsedDate) return;
    haptics.confirm();
    interaction.addImportantDate({ type, label: label.trim(), date: parsedDate });
    setLabel('');
    setDateInput('');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.typeRow}>
            {TYPES.map((v) => (
              <Pressable
                key={v}
                onPress={() => setType(v)}
                style={[
                  styles.typeChip,
                  {
                    borderColor: type === v ? colors.primary : colors.border,
                    backgroundColor: type === v ? colors.background : colors.card,
                    borderWidth: type === v ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.typeChipText, { color: colors.text }]}>{typeLabel(v)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t('importantDates.labelPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <TextInput
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="ГГГГ-ММ-ДД"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <PrimaryButton label={t('importantDates.addButton')} onPress={handleAdd} disabled={!label.trim() || !parsedDate} />
        </View>

        {sorted.length === 0 ? (
          <EmptyState
            icon="notification"
            title={t('importantDates.emptyTitle')}
            description={t('importantDates.emptyDescription')}
          />
        ) : (
          sorted.map((item) => {
            const days = daysUntilNextOccurrence(item.date);
            return (
              <View
                key={item.id}
                style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardBody}>
                  <Text style={[styles.cardLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.cardType, { color: colors.textSecondary }]}>{typeLabel(item.type)}</Text>
                </View>
                <Text style={[styles.cardDays, { color: colors.primary }]}>
                  {days === 0 ? t('importantDates.today') : t('importantDates.daysUntil', { days })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
  );
};

export const ImportantDatesScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('importantDates.title')} onBack={() => navigation.goBack()} />
      <ImportantDatesBody />
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
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  typeChip: {
    borderRadius: radius.round,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  typeChipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardType: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cardDays: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
