import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useTranslation } from '../../localization/useTranslation';
import { FIXED_AVATAR_ID } from '../../constants/assets';

type Props = NativeStackScreenProps<RootStackParamList, 'Name'>;

const MIN_LENGTH = 2;

export const NameScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { userName, selectedRole, selectedAvatar, language, actions } = useAppStore();
  const auth = useAuth();
  const { t } = useTranslation();
  // Pre-fill with whatever's already there (e.g. re-entering this step)
  // instead of the generic local placeholder.
  const [name, setName] = useState(userName === 'Ты' ? '' : userName);
  const submittingRef = useRef(false);

  const trimmed = name.trim();
  const isValid = trimmed.length >= MIN_LENGTH;
  const showHint = name.length > 0 && !isValid;

  // Once the anonymous session AND a real profile row both exist, hand
  // control back to Splash -- it's the single place that decides Main vs
  // ConnectPartner. Gating on `auth.profile` itself (not just
  // `!auth.profileLoading`) matters here: the profile SELECT that drives
  // `profileLoading` is triggered independently by the auth-state listener
  // and can resolve to "not found yet" before signInAnonymously()'s own
  // profile INSERT has committed. Navigating on that premature resolution
  // let users reach ConnectPartner with no profiles row yet, which made
  // createCouple() fail its `couples_created_by_fkey` check.
  useEffect(() => {
    if (!auth.session || !auth.profile) return;
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  }, [auth.session, auth.profile, navigation]);

  const handleContinue = async () => {
    if (!isValid || auth.loading || submittingRef.current) return;
    if (!auth.configured) {
      // Local-only mode: Splash routes on `onboardingComplete`, so it must be
      // persisted (together with the name) before handing control back.
      submittingRef.current = true;
      await actions.completeOnboarding({ userName: trimmed });
      navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
      return;
    }
    actions.setUserName(trimmed);
    const role = selectedRole ?? 'male';
    await auth.signInAnonymously({
      name: trimmed,
      role,
      selectedAvatar: selectedAvatar ?? FIXED_AVATAR_ID[role],
      language,
    });
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('name.title')} onBack={() => navigation.goBack()} />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('name.subtitle')}</Text>
      {auth.error && <BackendStatusBanner message={auth.error} onRetry={auth.clearError} />}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('name.placeholder')}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="words"
        autoFocus
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
      />
      {showHint && <Text style={[styles.error, { color: colors.danger }]}>{t('name.tooShort')}</Text>}
      {auth.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <PrimaryButton label={t('name.continue')} onPress={handleContinue} disabled={!isValid} />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  error: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  center: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
