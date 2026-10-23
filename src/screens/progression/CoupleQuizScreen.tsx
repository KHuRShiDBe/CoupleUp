import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useProgression } from '../../store/ProgressionContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { COUPLE_QUIZ_QUESTIONS } from '../../constants/coupleQuiz';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleQuiz'>;

export const CoupleQuizScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const progression = useProgression();
  const userId = auth.session?.user?.id;
  const partnerId = sync.partner?.id;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const submit = async (questionKey: string) => {
    const value = (drafts[questionKey] ?? '').trim();
    if (!value) return;
    haptics.confirm();
    await progression.submitQuizAnswer(questionKey, value);
    setDrafts((prev) => ({ ...prev, [questionKey]: '' }));
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('coupleQuiz.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('coupleQuiz.subtitle')}</Text>
        {COUPLE_QUIZ_QUESTIONS.map((q) => {
          const myAnswer = progression.quizAnswers.find((a) => a.question_key === q.key && a.user_id === userId);
          const partnerAnswer = progression.quizAnswers.find((a) => a.question_key === q.key && a.user_id === partnerId);
          const bothAnswered = !!myAnswer && !!partnerAnswer;

          return (
            <View key={q.key} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.prompt, { color: colors.text }]}>{t(q.promptKey)}</Text>
              {bothAnswered ? (
                <View style={styles.answersRow}>
                  <View style={styles.answerCol}>
                    <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>{t('coupleQuiz.you')}</Text>
                    <Text style={[styles.answerValue, { color: colors.text }]}>{myAnswer!.answer}</Text>
                  </View>
                  <View style={styles.answerCol}>
                    <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>{t('coupleQuiz.partner')}</Text>
                    <Text style={[styles.answerValue, { color: colors.text }]}>{partnerAnswer!.answer}</Text>
                  </View>
                </View>
              ) : myAnswer ? (
                <Text style={[styles.waiting, { color: colors.textSecondary }]}>{t('coupleQuiz.waitingForPartner')}</Text>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    value={drafts[q.key] ?? ''}
                    onChangeText={(text) => setDrafts((prev) => ({ ...prev, [q.key]: text }))}
                    placeholder={t('coupleQuiz.answerPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                  <PrimaryButton label={t('coupleQuiz.submit')} onPress={() => submit(q.key)} style={styles.submitButton} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  prompt: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  inputRow: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  submitButton: {
    height: 44,
  },
  waiting: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  answersRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  answerCol: {
    flex: 1,
  },
  answerLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  answerValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
