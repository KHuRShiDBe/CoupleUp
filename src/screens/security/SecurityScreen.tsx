import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useAuth } from '../../store/AuthContext';
import * as accountService from '../../services/supabase/accountService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Security'>;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export const SecurityScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const auth = useAuth();
  const user = auth.session?.user ?? null;
  // Supabase marks a session anonymous with `is_anonymous`; treat "no email"
  // the same way as a fallback for older sessions that predate the field.
  const isAnonymous = user?.is_anonymous ?? !user?.email;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  const handleSetupRecovery = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await accountService.setupRecovery(email.trim(), password);
      haptics.success();
      setSuccess(true);
    } catch (e) {
      haptics.error();
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    haptics.confirm();
    setConfirmSignOut(false);
    await auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Безопасность" onBack={() => navigation.goBack()} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Восстановление аккаунта</Text>
        <View
          style={[
            styles.statusCard,
            shadow.soft,
            { backgroundColor: colors.card, borderColor: isAnonymous ? colors.border : colors.success },
          ]}
        >
          <Text style={[styles.statusLabel, { color: isAnonymous ? colors.textSecondary : colors.success }]}>
            {isAnonymous ? 'Восстановление не настроено' : 'Аккаунт защищён'}
          </Text>
          {!isAnonymous && user?.email && (
            <Text style={[styles.statusEmail, { color: colors.textSecondary }]}>{user.email}</Text>
          )}
        </View>

        {isAnonymous && (
          <View>
            <Text style={[styles.warning, { color: colors.textSecondary }]}>
              Настрой восстановление, чтобы не потерять данные при смене телефона. Это не обязательно — приложение
              продолжит работать и без этого.
            </Text>

            {!success ? (
              <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Пароль (минимум 6 символов)"
                  secureTextEntry
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                />
                {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
                {saving ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <PrimaryButton label="Настроить восстановление" onPress={handleSetupRecovery} disabled={!canSubmit} />
                )}
              </View>
            ) : (
              <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.success }]}>
                <Text style={[styles.successText, { color: colors.success }]}>
                  Готово. Проверьте почту {email.trim()}, чтобы подтвердить email — после этого вход по email и паролю
                  будет работать на любом устройстве.
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Новый телефон?</Text>
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isAnonymous ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Восстановление ещё не настроено. Если вы потеряете доступ к этому телефону сейчас, вернуть профиль, пару,
              баллы и историю будет невозможно — настройте email и пароль выше заранее.
            </Text>
          ) : (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Восстановление настроено. На новом телефоне войдите с тем же email и паролем — вернутся профиль, пара,
              баллы, история, цели и BOND без создания нового аккаунта.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Сессия и устройство</Text>
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Текущая сессия</Text>
            <Text style={[styles.rowValue, { color: colors.success }]}>Активна</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Аккаунт создан</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{formatDate(user?.created_at)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Последняя активность</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{formatDate(user?.last_sign_in_at)}</Text>
          </View>
        </View>

        <PrimaryButton label="Выйти из аккаунта" onPress={() => setConfirmSignOut(true)} variant="outline" style={styles.signOutButton} />
      </ScrollView>

      <ConfirmationModal
        visible={confirmSignOut}
        title="Выйти из аккаунта?"
        message="Ваши данные останутся на сервере. При следующем входе с этим же способом восстановления всё вернётся."
        confirmLabel="Выйти"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statusCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  statusEmail: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  warning: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  center: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  body: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    fontSize: fontSize.sm,
  },
  rowValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: spacing.sm,
  },
});
