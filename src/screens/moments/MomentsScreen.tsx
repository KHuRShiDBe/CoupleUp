import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Moments'>;

const todayIso = () => new Date().toISOString().slice(0, 10);

export const MomentsBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const interaction = useCoupleInteraction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    haptics.confirm();
    interaction.addMoment({ title: title.trim(), description: description.trim() || undefined, momentDate: todayIso() });
    setTitle('');
    setDescription('');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('moments.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('moments.descriptionPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              styles.descriptionInput,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
          <PrimaryButton label={t('moments.addButton')} onPress={handleAdd} disabled={!title.trim()} />
        </View>

        {interaction.moments.length === 0 ? (
          <EmptyState icon="goal" title={t('moments.emptyTitle')} description={t('moments.emptyDescription')} />
        ) : (
          <View style={styles.timeline}>
            {interaction.moments.map((moment, index) => (
              <View key={moment.id} style={styles.timelineRow}>
                <View style={styles.timelineMarkerColumn}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  {index < interaction.moments.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                </View>
                <View style={[styles.timelineCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>
                    {new Date(moment.moment_date).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.timelineTitle, { color: colors.text }]}>{moment.title}</Text>
                  {!!moment.description && (
                    <Text style={[styles.timelineDescription, { color: colors.textSecondary }]}>{moment.description}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
  );
};

export const MomentsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('moments.title')} onBack={() => navigation.goBack()} />
      <MomentsBody />
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
  descriptionInput: {
    height: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  timeline: {
    marginTop: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineMarkerColumn: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: spacing.md,
  },
  timelineLine: {
    width: 2,
    flex: 1,
  },
  timelineCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  timelineDate: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  timelineDescription: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
});
