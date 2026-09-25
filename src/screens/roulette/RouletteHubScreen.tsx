import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';
import { useTranslation } from '../../localization/useTranslation';
import { useAuth } from '../../store/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'RouletteHub'>;

const INTIMATE_ROULETTE_ICON = require('../../../assets/roulette/intimate-roulette-icon.png');
const SHOP_ROULETTE_ICON = require('../../../assets/roulette/shop-roulette.png');

// The single entry point to both roulettes -- reached only from the header
// icon on Home. Picking one here pushes that roulette's own screen; its
// own back button returns here, and this screen's back button returns to
// Home. Neither roulette's cost/prizes/mechanics/backend are touched by
// this screen -- it's pure navigation.
export const RouletteHubScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const isFemale = auth.profile?.role === 'female';

  return (
    <ScreenContainer>
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
        <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
          <IconImage name="shop" size={24} />
        </View>
        <Text style={[styles.rouletteLabel, { color: colors.text }]}>{t('roulette.cardLabel')}</Text>
        <Text style={[styles.rouletteArrow, { color: colors.primary }]}>→</Text>
      </Pressable>

      {/* Female accounts get the Shop Roulette here instead of the intimate
          one -- same slot, same card position. Male accounts are completely
          unaffected: same screen, same mechanics as before. */}
      <Pressable
        onPress={() => navigation.navigate(isFemale ? 'ShopRoulette' : 'IntimateRoulette')}
        style={({ pressed }) => [
          styles.rouletteCard,
          shadow.soft,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Image source={isFemale ? SHOP_ROULETTE_ICON : INTIMATE_ROULETTE_ICON} style={styles.rouletteIcon} resizeMode="contain" />
        <Text style={[styles.rouletteLabel, { color: colors.text }]}>
          {t(isFemale ? 'shopRoulette.cardLabel' : 'intimateRoulette.cardLabel')}
        </Text>
        <Text style={[styles.rouletteArrow, { color: colors.primary }]}>→</Text>
      </Pressable>
    </ScreenContainer>
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
    borderRadius: 25,
    marginRight: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
