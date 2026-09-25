import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useMockLoading } from '../../hooks/useMockLoading';
import { useAppStore } from '../../store/AppContext';
import { IconName } from '../../types';
import { TranslationKey, useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;

const GAMES: { titleKey: TranslationKey; descriptionKey: TranslationKey; icon: IconName; onPress: (nav: Props['navigation']) => void }[] = [
  {
    titleKey: 'games.quiz1Title',
    descriptionKey: 'games.quiz1Description',
    icon: 'message',
    onPress: (nav) => nav.navigate('PartnerQuiz', { quizId: 'partner-1' }),
  },
  {
    titleKey: 'games.truthOrDareTitle',
    descriptionKey: 'games.truthOrDareDescription',
    icon: 'pair',
    onPress: (nav) => nav.navigate('TruthOrDare'),
  },
  {
    titleKey: 'games.eitherOrTitle',
    descriptionKey: 'games.eitherOrDescription',
    icon: 'shop',
    onPress: (nav) => nav.navigate('EitherOr'),
  },
  {
    titleKey: 'games.questionOfDayTitle',
    descriptionKey: 'games.questionOfDayDescription',
    icon: 'notification',
    onPress: (nav) => nav.navigate('QuestionOfTheDay'),
  },
  {
    titleKey: 'games.quiz2Title',
    descriptionKey: 'games.quiz2Description',
    icon: 'achievement',
    onPress: (nav) => nav.navigate('PartnerQuiz', { quizId: 'partner-2' }),
  },
];

export const GamesScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { gameHistory } = useAppStore();
  const loading = useMockLoading();

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('games.title')} onBack={() => navigation.goBack()} />
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('games.title')} onBack={() => navigation.goBack()} />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('games.subtitle')}</Text>

        {GAMES.map((game) => (
          <Pressable
            key={game.titleKey}
            onPress={() => game.onPress(navigation)}
            style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
              <IconImage name={game.icon} size={24} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t(game.titleKey)}</Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{t(game.descriptionKey)}</Text>
            </View>
            <View style={[styles.playBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.playText, { color: colors.textOnPrimary }]}>{t('games.play')}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('games.gameHistory')}</Text>
        {gameHistory.length === 0 ? (
          <EmptyState icon="shop" title={t('games.emptyHistoryTitle')} description={t('games.emptyHistoryDescription')} />
        ) : (
          gameHistory.slice(0, 10).map((entry) => (
            <View key={entry.id} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.historyBody}>
                <Text style={[styles.historyGame, { color: colors.text }]} numberOfLines={1}>
                  {entry.game}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>
                  {entry.result} · {entry.date}
                </Text>
              </View>
              <Text style={[styles.historyPoints, { color: entry.points > 0 ? colors.success : colors.textSecondary }]}>
                {entry.points > 0 ? `+${entry.points}` : '—'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  playBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.round,
  },
  playText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  historyBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyGame: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  historyMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  historyPoints: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
