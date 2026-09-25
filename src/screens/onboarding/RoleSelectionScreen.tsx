import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { getTheme } from '../../theme/colors';
import { fontSize, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { RoleCard } from '../../components/cards/RoleCard';
import { useAppStore } from '../../store/AppContext';
import { Role } from '../../types';
import { FIXED_AVATAR_ID } from '../../constants/assets';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelection'>;

export const RoleSelectionScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { actions } = useAppStore();
  const { t } = useTranslation();
  const [role, setRole] = useState<Role | null>(null);

  const pickRole = (next: Role) => {
    haptics.select();
    setRole(next);
  };

  const handleContinue = () => {
    if (!role) return;
    actions.setRole(role);
    // No more avatar catalog to pick from -- one fixed avatar per role,
    // set immediately (AvatarSelectionScreen stays registered but is no
    // longer part of the onboarding flow).
    actions.setAvatar(FIXED_AVATAR_ID[role]);
    navigation.navigate('Name');
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />
      <Text style={[styles.title, { color: colors.text }]}>{t('roleSelection.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('roleSelection.subtitle')}</Text>
      <View style={styles.cards}>
        <RoleCard
          role="male"
          title={t('roleSelection.maleTitle')}
          subtitle={t('roleSelection.maleSubtitle')}
          selected={role === 'male'}
          onPress={() => pickRole('male')}
        />
        <RoleCard
          role="female"
          title={t('roleSelection.femaleTitle')}
          subtitle={t('roleSelection.femaleSubtitle')}
          selected={role === 'female'}
          onPress={() => pickRole('female')}
        />
      </View>
      <PrimaryButton
        label={t('roleSelection.continue')}
        onPress={handleContinue}
        disabled={!role}
        colorOverride={role ? { primary: getTheme(role).primary, textOnPrimary: getTheme(role).textOnPrimary } : undefined}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    marginBottom: spacing.xl,
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
});
