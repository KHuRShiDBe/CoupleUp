import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'RouletteHub'>;

// Premium roulette artwork, kept as distinct images (not flat Ionicons
// glyphs) so these two entry cards still stand out visually.
const COUPLE_ROULETTE_ICON = require('../../../assets/couple-roulette.png');
const INTIMATE_ROULETTE_ICON = require('../../../assets/roulette/intimate-roulette-icon.png');

// The single entry point to both roulettes -- reached only from the header
// icon on Home. Picking one here pushes that roulette's own screen; its
// own back button returns here, and this screen's back button returns to
// Home. Neither roulette's cost/prizes/mechanics/backend are touched by
// this screen -- it's pure navigation.
export const RouletteHubScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('roulette.hubTitle')} onBack={() => navigation.goBack()} />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('roulette.hubSubtitle')}</Text>

      <Pressable
        onPress={() => navigation.navigate('WishRoulette')}
        style={({ pressed }) => [
          styles.rouletteCard,
          shadow.soft,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Image source={COUPLE_ROULETTE_ICON} style={styles.rouletteIcon} resizeMode="contain" />
        <Text style={[styles.rouletteLabel, { color: colors.text }]}>{t('roulette.cardLabel')}</Text>
        <Text style={[styles.rouletteArrow, { color: colors.primary }]}>→</Text>
      </Pressable>

      {/* Same screen (IntimateRoulette) and same consent flow for both
          roles -- was routed to a separate, consent-free ShopRoulette for
          female accounts, which caused the two partners to see different
          gating. */}
      <Pressable
        onPress={() => navigation.navigate('IntimateRoulette')}
        style={({ pressed }) => [
          styles.rouletteCard,
          shadow.soft,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Image source={INTIMATE_ROULETTE_ICON} style={styles.rouletteIcon} resizeMode="contain" />
        <Text style={[styles.rouletteLabel, { color: colors.text }]}>{t('intimateRoulette.cardLabel')}</Text>
        <Text style={[styles.rouletteArrow, { color: colors.primary }]}>→</Text>
      </Pressable>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  rouletteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rouletteIcon: {
    width: 50,
    height: 50,
    marginRight: spacing.md,
  },
  rouletteLabel: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  rouletteArrow: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
