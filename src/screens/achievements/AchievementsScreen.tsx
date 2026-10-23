import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useMockLoading } from '../../hooks/useMockLoading';
import { useCoupleStats } from '../../store/useCoupleStats';
import { useProgression } from '../../store/ProgressionContext';
import { TranslationKey, useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export const AchievementsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { achievements: liveAchievements } = useCoupleStats();
  const progression = useProgression();
  const loading = useMockLoading();
  const seenUnlocked = useRef<Set<string>>(new Set());

  // Persist-once: an achievement whose live criterion is newly met gets
  // permanently recorded via unlockAchievement (idempotent -- see
  // progressionService, 23505 = already unlocked). This is what keeps an
  // achievement unlocked even if the underlying stat later regresses (e.g.
  // best streak is monotonic so it can't, but this pattern generalizes).
  useEffect(() => {
    liveAchievements.forEach((a) => {
      if (a.unlocked && !progression.achievementUnlocks.some((u) => u.achievement_key === a.id)) {
        progression.unlockAchievement(a.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAchievements, progression.achievementUnlocks]);

  const achievements = liveAchievements.map((a) => ({
    ...a,
    unlocked: a.unlocked || progression.achievementUnlocks.some((u) => u.achievement_key === a.id),
  }));

  useEffect(() => {
    const newlyUnlocked = achievements.filter((a) => a.unlocked && !seenUnlocked.current.has(a.id));
    if (newlyUnlocked.length > 0 && seenUnlocked.current.size > 0) {
      haptics.success();
    }
    achievements.forEach((a) => {
      if (a.unlocked) seenUnlocked.current.add(a.id);
    });
  }, [achievements]);

  if (loading) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('achievements.title')} onBack={() => navigation.goBack()} />
        <LoadingState />
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('achievements.title')} onBack={() => navigation.goBack()} />
        {achievements.length === 0 && (
          <EmptyState icon="achievement" title={t('achievements.emptyTitle')} description={t('achievements.emptyDescription')} />
        )}
        {achievements.map((item) => (
          <View
            key={item.id}
            style={[
              styles.card,
              shadow.soft,
              {
                backgroundColor: item.unlocked ? colors.card : colors.background,
                borderColor: item.unlocked ? colors.primary : colors.border,
                opacity: item.unlocked ? 1 : 0.6,
              },
            ]}
          >
            <View style={styles.iconWrap}>
              <IconImage
                name={item.unlocked ? 'achievement' : 'lock'}
                size={32}
                color={item.unlocked ? undefined : colors.textSecondary}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t(`achievements.${item.id}` as TranslationKey)}</Text>
              {/* Progress bar always renders (100% when unlocked) so every card in
                  the list holds the same height, locked or not. */}
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${(item.current / item.target) * 100}%` },
                  ]}
                />
              </View>
              <Text style={[styles.cardStatus, { color: item.unlocked ? colors.primary : colors.textSecondary }]}>
                {item.unlocked ? t('achievements.unlocked') : t('achievements.progress', { current: item.current, target: item.target })}
              </Text>
            </View>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    marginRight: spacing.md,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardStatus: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
  },
});
