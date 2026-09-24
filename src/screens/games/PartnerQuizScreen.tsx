import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useGames } from '../../store/GamesContext';
import { useTranslation } from '../../localization/useTranslation';
import { PARTNER_QUIZZES, QuizId } from '../../constants/gameContent';
import { InvalidParamsState } from '../../components/common/InvalidParamsState';

type Props = NativeStackScreenProps<RootStackParamList, 'PartnerQuiz'>;

const POINTS_PER_CORRECT = 2;

const isQuizId = (value: unknown): value is QuizId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PARTNER_QUIZZES, value);

export const PartnerQuizScreen = (props: Props) => {
  const { t } = useTranslation();
  const quizId: unknown = props.route.params?.quizId;
  if (!isQuizId(quizId)) return <InvalidParamsState message={t('recovery.invalidQuiz')} />;
  return <PartnerQuizContent {...props} quizId={quizId} />;
};

const PartnerQuizContent = ({ navigation, quizId }: Props & { quizId: QuizId }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const games = useGames();
  const { title, questions } = PARTNER_QUIZZES[quizId];
  const myId = auth.session?.user?.id ?? null;
  const partnerId = sync.partner?.id ?? null;

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const submitted = useRef(false);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const partnerAnswers = partnerId
    ? games.partnerQuizAnswers.filter((a) => a.quiz_id === quizId && a.user_id === partnerId)
    : [];
  const partnerFinished = partnerAnswers.length >= questions.length;
  const partnerCorrect = partnerAnswers.filter((a) => questions[a.question_index]?.correctIndex === a.selected_index).length;

  const handleSelect = (optionIndex: number) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === current.correctIndex) setCorrectCount((c) => c + 1);
    games.submitPartnerQuizAnswer(quizId, index, optionIndex);
  };

  const handleNext = async () => {
    if (isLast) {
      setFinished(true);
      if (!submitted.current) {
        submitted.current = true;
        await games.claimGameReward(`partner_quiz:${quizId}:${myId}`, correctCount * POINTS_PER_CORRECT, title);
      }
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  if (!auth.configured) {
    return (
      <ScreenContainer>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer>
    );
  }

  if (finished) {
    return (
      <ScreenContainer>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <View style={styles.resultWrap}>
          <View style={[styles.resultCard, shadow.soft, { backgroundColor: colors.primary }]}>
            <Text style={[styles.resultValue, { color: colors.textOnPrimary }]}>
              {correctCount}/{questions.length}
            </Text>
            <Text style={[styles.resultLabel, { color: colors.textOnPrimary }]}>{t('partnerQuiz.correctAnswers')}</Text>
          </View>
          <Text style={[styles.partnerStatus, { color: colors.textSecondary }]}>
            {partnerFinished
              ? t('partnerQuiz.partnerScore', { score: `${partnerCorrect}/${questions.length}` })
              : t('partnerQuiz.waitingForPartner')}
          </Text>
          <PrimaryButton label={t('partnerQuiz.done')} onPress={() => navigation.goBack()} style={styles.doneButton} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        {t('partnerQuiz.questionProgress', { current: index + 1, total: questions.length })}
      </Text>
      <View style={[styles.questionCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.question, { color: colors.text }]}>{current.question}</Text>
      </View>

      {current.options.map((option, optionIndex) => {
        const isSelected = selected === optionIndex;
        const isCorrect = optionIndex === current.correctIndex;
        const showState = selected !== null;
        const borderColor = showState
          ? isCorrect
            ? colors.success
            : isSelected
              ? colors.danger
              : colors.border
          : colors.border;

        return (
          <Pressable
            key={option}
            onPress={() => handleSelect(optionIndex)}
            disabled={selected !== null}
            style={[styles.option, { backgroundColor: colors.card, borderColor, borderWidth: showState && (isCorrect || isSelected) ? 2 : 1 }]}
          >
            <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
          </Pressable>
        );
      })}

      {selected !== null && (
        <PrimaryButton
          label={isLast ? t('partnerQuiz.finish') : t('partnerQuiz.next')}
          onPress={handleNext}
          style={styles.nextButton}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  progress: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  questionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  question: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  option: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButton: {
    marginTop: spacing.md,
  },
  resultWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  resultCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultValue: {
    fontSize: 44,
    fontWeight: '800',
  },
  resultLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  partnerStatus: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  doneButton: {
    width: '100%',
  },
});
