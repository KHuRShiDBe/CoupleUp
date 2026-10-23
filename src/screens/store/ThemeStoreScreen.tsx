import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { maleTheme, femaleTheme } from '../../theme/colors';
import { PREMIUM_THEME_IDS, PREMIUM_THEMES } from '../../theme/premiumThemes';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAppStore } from '../../store/AppContext';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'ThemeStore'>;

export const ThemeStoreScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const { ownedThemes, selectedPremiumTheme } = useAppStore();

  const BASE_THEMES = [
    { title: t('settings.themeBlue'), colors: maleTheme, matchRole: 'male' as const },
    { title: t('settings.themePink'), colors: femaleTheme, matchRole: 'female' as const },
  ];

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('themeStore.title')} onBack={() => navigation.goBack()} />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('themeStore.subtitle')}</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('themeStore.baseThemes')}</Text>
        <View style={styles.grid}>
          {BASE_THEMES.map((theme) => {
            const isActive = !selectedPremiumTheme && role === theme.matchRole;
            return (
              <View
                key={theme.title}
                style={[
                  styles.card,
                  shadow.soft,
                  { backgroundColor: colors.card, borderColor: isActive ? theme.colors.primary : colors.border },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={[styles.swatchDot, { backgroundColor: theme.colors.primary }]} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{theme.title}</Text>
                <Text style={[styles.statusFree, { color: colors.success }]}>{t('themeStore.free')}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('themeStore.premiumThemes')}</Text>
        <View style={styles.grid}>
          {PREMIUM_THEME_IDS.map((id) => {
            const meta = PREMIUM_THEMES[id];
            const owned = ownedThemes.includes(id);
            const isActive = selectedPremiumTheme === id;
            return (
              <Pressable
                key={id}
                onPress={() => navigation.navigate('ThemePreview', { themeId: id })}
                style={[
                  styles.card,
                  shadow.soft,
                  { backgroundColor: colors.card, borderColor: isActive ? meta.colors.primary : colors.border },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: meta.colors.background, borderColor: meta.colors.border }]}>
                  <View style={[styles.swatchDot, { backgroundColor: meta.colors.primary }]} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{meta.title}</Text>
                <Text style={[styles.statusText, { color: owned ? colors.success : colors.primary }]}>
                  {owned ? t('themeStore.owned') : `${t('themeStore.premium')} · ${meta.price}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  card: {
    width: '48%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  swatch: {
    width: '100%',
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  swatchDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusFree: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
