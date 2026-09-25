import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useGames } from '../../store/GamesContext';
import { useTranslation } from '../../localization/useTranslation';
import { pickDeterministicPrompt } from '../../constants/gameContent';

type Props = NativeStackScreenProps<RootStackParamList, 'TruthOrDare'>;

const TOTAL_ROUNDS = 6;
const REWARD = 5;

export const TruthOrDareScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const games = useGames();
  const title = t('truthOrDare.title');
  const [finished, setFinished] = useState(false);

  const coupleId = sync.couple?.id ?? null;
  const round = games.truthOrDareProgress?.current_round ?? 1;
  const kind = games.truthOrDareProgress?.current_kind ?? null;
  // Both phones derive the SAME prompt text from the shared (couple_id,
  // round, kind) triple -- see pickDeterministicPrompt -- instead of each
  // calling Math.random() independently.
  const prompt = kind && coupleId ? pickDeterministicPrompt(coupleId, round, kind) : null;

  const pickKind = (k: 'truth' | 'dare') => games.setTruthOrDareKind(k);

  const handleNext = async () => {
    const wasLastRound = round >= TOTAL_ROUNDS;
    await games.advanceTruthOrDare(TOTAL_ROUNDS, REWARD, title);
    if (wasLastRound) setFinished(true);
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
              {TOTAL_ROUNDS}/{TOTAL_ROUNDS}
            </Text>
            <Text style={[styles.resultLabel, { color: colors.textOnPrimary }]}>{t('truthOrDare.roundsDone')}</Text>
          </View>
          <PrimaryButton label={t('partnerQuiz.done')} onPress={() => navigation.goBack()} style={styles.doneButton} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {!!games.error && <BackendStatusBanner message={games.error} onRetry={games.clearError} />}
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        {t('truthOrDare.roundProgress', { round, total: TOTAL_ROUNDS })}
      </Text>

      {!prompt ? (
        <View style={styles.chooseWrap}>
          <PrimaryButton label={t('truthOrDare.truth')} onPress={() => pickKind('truth')} style={styles.chooseButton} />
          <PrimaryButton label={t('truthOrDare.dare')} onPress={() => pickKind('dare')} variant="outline" style={styles.chooseButton} />
        </View>
      ) : (
        <View>
          <View style={[styles.promptCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.promptText, { color: colors.text }]}>{prompt}</Text>
          </View>
          <PrimaryButton label={round >= TOTAL_ROUNDS ? t('partnerQuiz.finish') : t('truthOrDare.nextRound')} onPress={handleNext} />
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  progress: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  chooseWrap: {
    gap: spacing.md,
  },
  chooseButton: {
    height: 64,
  },
  promptCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  promptText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  resultWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  resultCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  resultValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  resultLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  doneButton: {
    width: '100%',
  },
});
