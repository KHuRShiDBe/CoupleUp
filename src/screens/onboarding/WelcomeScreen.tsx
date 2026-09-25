import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { maleTheme, femaleTheme } from '../../theme/colors';
import { fontSize, spacing } from '../../theme/layout';
import { logo } from '../../constants/assets';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <View style={[styles.glow, styles.glowBlue, { backgroundColor: maleTheme.primary }]} />
          <View style={[styles.glow, styles.glowPink, { backgroundColor: femaleTheme.primary }]} />
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t('welcome.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('welcome.subtitle')}</Text>
      </View>
      <PrimaryButton label={t('welcome.start')} onPress={() => navigation.navigate('RoleSelection')} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.16,
  },
  glowBlue: {
    left: -8,
    top: -6,
  },
  glowPink: {
    right: -8,
    bottom: -6,
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
});
