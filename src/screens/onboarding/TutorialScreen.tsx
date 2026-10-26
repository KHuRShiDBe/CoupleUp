import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { logo } from '../../constants/assets';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { IconImage } from '../../components/common/IconImage';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { useAppStore } from '../../store/AppContext';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { IconName } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

type Slide = {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
};

// Which flat icon illustrates each slide -- the first and last slides (welcome/closing)
// use the app logo instead, handled separately below.
const SLIDE_ICON: Partial<Record<number, IconName>> = {
  1: 'periodDaily',
  3: 'add',
  4: 'notification',
  5: 'roulette',
  6: 'savings',
};

const SLIDES: Slide[] = [
  { titleKey: 'tutorial.slide1Title', bodyKey: 'tutorial.slide1Body' },
  { titleKey: 'tutorial.slide2Title', bodyKey: 'tutorial.slide2Body' },
  { titleKey: 'tutorial.slide3Title', bodyKey: 'tutorial.slide3Body' },
  { titleKey: 'tutorial.slide4Title', bodyKey: 'tutorial.slide4Body' },
  { titleKey: 'tutorial.slide5Title', bodyKey: 'tutorial.slide5Body' },
  { titleKey: 'tutorial.slide6Title', bodyKey: 'tutorial.slide6Body' },
  { titleKey: 'tutorial.slideBondTitle', bodyKey: 'tutorial.slideBondBody' },
  { titleKey: 'tutorial.slide7Title', bodyKey: 'tutorial.slide7Body' },
];

export const TutorialScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { actions } = useAppStore();
  const { t } = useTranslation();
  const manual = route.params?.manual ?? false;
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const finish = () => {
    actions.completeTutorial();
    if (manual) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const slide = SLIDES[index];

  return (
    <ScreenBackground>
      <ScreenContainer transparent>
        <View style={styles.top}>
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={[styles.skip, { color: colors.textSecondary }]}>{t('tutorial.skip')}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.illustrationWrap}>
            {index === 2 ? (
              <View style={styles.iconGrid}>
                <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <IconImage name="periodDaily" size={32} />
                  <Text style={[styles.gridLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {t('tutorial.slide3Card1')}
                  </Text>
                </View>
                <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <IconImage name="savings" size={32} />
                  <Text style={[styles.gridLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {t('tutorial.slide3Card2')}
                  </Text>
                </View>
                <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <IconImage name="wishlist" size={32} />
                  <Text style={[styles.gridLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {t('tutorial.slide3Card3')}
                  </Text>
                </View>
                <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <IconImage name="wishlist" size={32} />
                  <Text style={[styles.gridLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {t('tutorial.slide3Card4')}
                  </Text>
                </View>
              </View>
            ) : index === 0 || index === SLIDES.length - 1 ? (
              <Image source={logo} style={styles.illustration} resizeMode="contain" />
            ) : (
              <IconImage name={SLIDE_ICON[index]!} size={96} />
            )}
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t(slide.titleKey)}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{t(slide.bodyKey)}</Text>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 20 : 8 },
              ]}
            />
          ))}
        </View>

        <PrimaryButton label={isLast ? t('tutorial.start') : t('tutorial.next')} onPress={handleNext} />
      </ScreenContainer>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skip: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    padding: spacing.sm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  illustration: {
    width: 120,
    height: 120,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 200,
    justifyContent: 'space-between',
  },
  gridCell: {
    width: 92,
    height: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    padding: spacing.xs,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
