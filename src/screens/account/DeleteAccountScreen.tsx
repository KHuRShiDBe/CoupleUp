import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../store/AuthContext';
import { useAppStore } from '../../store/AppContext';
import * as accountService from '../../services/supabase/accountService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { Language } from '../../localization';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

// The exact word the user must type to confirm, in their selected app
// language (spec requires this even though the rest of this screen -- like
// AccountScreen/CoupleProfileScreen -- stays Russian-only, matching the
// established scope boundary from the localization pass).
const CONFIRM_WORD: Record<Language, string> = { ru: 'УДАЛИТЬ', en: 'DELETE', uz: "O'CHIRISH" };

export const DeleteAccountScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const auth = useAuth();
  const { language } = useAppStore();
  const [showFirstConfirm, setShowFirstConfirm] = useState(false);
  const [step1Confirmed, setStep1Confirmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredWord = CONFIRM_WORD[language];
  const canDelete = confirmText.trim().toUpperCase() === requiredWord;

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      await accountService.requestAccountDeletion();
      haptics.confirm();
      await auth.signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
    } catch (e) {
      haptics.error();
      setError(friendlyMessage(toServiceError(e)));
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="Удаление аккаунта" onBack={() => navigation.goBack()} />

      <Text style={[styles.warning, { color: colors.text }]}>
        Это действие необратимо. Ваш аккаунт и вход будут удалены навсегда. Общая история и баллы пары, если вы в
        паре, останутся у партнёра — уходит только ваш аккаунт.
      </Text>

      {error && <ErrorState message={error} onRetry={handleDelete} />}

      {!step1Confirmed ? (
        <PrimaryButton
          label="Удалить аккаунт"
          onPress={() => setShowFirstConfirm(true)}
          variant="outline"
          colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
        />
      ) : (
        <View>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            Чтобы подтвердить, введите слово «{requiredWord}»:
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={requiredWord}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.danger} />
            </View>
          ) : (
            <PrimaryButton
              label="Окончательно удалить аккаунт"
              onPress={handleDelete}
              disabled={!canDelete}
              colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
            />
          )}
        </View>
      )}

      <ConfirmationModal
        visible={showFirstConfirm}
        title="Удалить аккаунт?"
        message="Это необратимо. На следующем шаге нужно будет ввести слово-подтверждение."
        confirmLabel="Продолжить"
        danger
        onConfirm={() => {
          setShowFirstConfirm(false);
          setStep1Confirmed(true);
        }}
        onCancel={() => setShowFirstConfirm(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  warning: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  instruction: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontWeight: '700',
  },
  center: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
