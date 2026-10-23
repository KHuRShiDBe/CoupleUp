import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { Avatar } from '../../components/common/Avatar';
import { useAppStore } from '../../store/AppContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestionOfTheDay'>;

export const QuestionOfTheDayScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const { dailyQuestion, selectedAvatar } = useAppStore();
  const sync = useCoupleSync();
  const interaction = useCoupleInteraction();
  const [answer, setAnswer] = useState(interaction.myAnswerToday ?? '');
  const [revealed, setRevealed] = useState(false);

  const bothAnswered = !!interaction.myAnswerToday && !!interaction.partnerAnswerToday;

  const handleSave = () => {
    if (!answer.trim()) return;
    interaction.submitAnswer(answer.trim());
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('questionOfDay.title')} onBack={() => navigation.goBack()} />
      <View style={[styles.card, shadow.soft, { backgroundColor: colors.primary }]}>
        <Text style={[styles.question, { color: colors.textOnPrimary }]}>{dailyQuestion}</Text>
      </View>

      {!interaction.myAnswerToday || !revealed ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('questionOfDay.yourAnswer')}</Text>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder={t('questionOfDay.placeholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            editable={!interaction.myAnswerToday}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />

          {!interaction.myAnswerToday && (
            <PrimaryButton label={t('questionOfDay.save')} onPress={handleSave} disabled={!answer.trim()} />
          )}

          {interaction.myAnswerToday && (
            <>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('questionOfDay.saved')}</Text>
              {!bothAnswered && (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('questionOfDay.waitingPartner')}</Text>
              )}
              {bothAnswered && (
                <PrimaryButton label={t('questionOfDay.reveal')} onPress={() => setRevealed(true)} style={styles.revealButton} />
              )}
            </>
          )}
        </>
      ) : (
        <View style={styles.revealRow}>
          <View style={styles.revealColumn}>
            <Avatar role={role} avatarId={selectedAvatar} size={48} />
            <Text style={[styles.revealLabel, { color: colors.textSecondary }]}>{t('questionOfDay.myAnswer')}</Text>
            <Text style={[styles.revealText, { color: colors.text }]}>{interaction.myAnswerToday}</Text>
          </View>
          <View style={styles.revealColumn}>
            <Avatar
              role={sync.partner?.role ?? (role === 'male' ? 'female' : 'male')}
              avatarId={sync.partner?.selected_avatar ?? null}
              size={48}
            />
            <Text style={[styles.revealLabel, { color: colors.textSecondary }]}>{t('questionOfDay.partnerAnswer')}</Text>
            <Text style={[styles.revealText, { color: colors.text }]}>{interaction.partnerAnswerToday}</Text>
          </View>
        </View>
      )}
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  question: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  revealButton: {
    marginTop: spacing.lg,
  },
  revealRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  revealColumn: {
    flex: 1,
    alignItems: 'center',
  },
  revealLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  revealText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
