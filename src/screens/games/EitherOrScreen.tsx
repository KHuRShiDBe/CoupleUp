import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useGames } from '../../store/GamesContext';
import { useTranslation } from '../../localization/useTranslation';
import { EITHER_OR_PAIRS } from '../../constants/gameContent';

type Props = NativeStackScreenProps<RootStackParamList, 'EitherOr'>;

const REWARD = 5;

export const EitherOrScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const games = useGames();
  const myId = auth.session?.user?.id ?? null;
  const partnerId = sync.partner?.id ?? null;
  const title = t('eitherOr.title');

  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const submitted = useRef(false);

  const pair = EITHER_OR_PAIRS[index];
  const isLast = index === EITHER_OR_PAIRS.length - 1;

  const partnerChoiceFor = (pairIndex: number): string | null =>
    partnerId ? games.eitherOrChoices.find((c) => c.pair_index === pairIndex && c.user_id === partnerId)?.choice ?? null : null;

  const handlePick = async (value: string) => {
    const nextChoices = [...choices, value];
    setChoices(nextChoices);
    games.submitEitherOrChoice(index, value);
    if (isLast) {
      setFinished(true);
      if (!submitted.current) {
        submitted.current = true;
        await games.claimGameReward(`either_or:${myId}`, REWARD, title);
      }
      return;
    }
    setIndex((i) => i + 1);
  };

  if (!auth.configured) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer></ScreenBackground>
    );
  }

  if (finished) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={[styles.resultCard, shadow.soft, { backgroundColor: colors.primary }]}>
            <Text style={[styles.resultValue, { color: colors.textOnPrimary }]}>
              {EITHER_OR_PAIRS.length}/{EITHER_OR_PAIRS.length}
            </Text>
            <Text style={[styles.resultLabel, { color: colors.textOnPrimary }]}>{t('eitherOr.choicesMade')}</Text>
          </View>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{t('eitherOr.yourChoices')}</Text>
          {choices.map((choice, i) => {
            const partnerChoice = partnerChoiceFor(i);
            return (
              <View key={`${choice}-${i}`} style={[styles.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryPair, { color: colors.textSecondary }]}>
                  {EITHER_OR_PAIRS[i][0]} / {EITHER_OR_PAIRS[i][1]}
                </Text>
                <Text style={[styles.summaryChoice, { color: colors.primary }]}>{choice}</Text>
                {partnerChoice && (
                  <Text
                    style={[
                      styles.summaryPartner,
                      { color: partnerChoice === choice ? colors.success : colors.textSecondary },
                    ]}
                  >
                    {t('eitherOr.partnerPicked', { choice: partnerChoice })}
                  </Text>
                )}
              </View>
            );
          })}
          <PrimaryButton label={t('partnerQuiz.done')} onPress={() => navigation.goBack()} style={styles.doneButton} />
        </ScrollView>
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        {t('partnerQuiz.questionProgress', { current: index + 1, total: EITHER_OR_PAIRS.length })}
      </Text>
      <View style={styles.pairWrap}>
        <Pressable
          onPress={() => handlePick(pair[0])}
          style={[styles.optionCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.optionText, { color: colors.text }]}>{pair[0]}</Text>
        </Pressable>
        <Text style={[styles.or, { color: colors.textSecondary }]}>{t('eitherOr.or')}</Text>
        <Pressable
          onPress={() => handlePick(pair[1])}
          style={[styles.optionCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.optionText, { color: colors.text }]}>{pair[1]}</Text>
        </Pressable>
      </View>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  progress: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  pairWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  optionCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  optionText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  or: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  resultCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  resultLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  summaryTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  summaryRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryPair: {
    fontSize: fontSize.xs,
  },
  summaryChoice: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryPartner: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  doneButton: {
    marginTop: spacing.lg,
  },
});
