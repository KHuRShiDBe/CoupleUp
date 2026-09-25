import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ErrorState } from '../../components/common/ErrorState';
import * as reportsService from '../../services/supabase/reportsService';
import { ReportReason } from '../../services/supabase/reportsService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportUser'>;

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'abuse', label: 'Оскорбления' },
  { key: 'spam', label: 'Спам' },
  { key: 'unwanted_contact', label: 'Нежелательный контакт' },
  { key: 'other', label: 'Другое' },
];

// Backend-ready, write-only: a submitted report is never shown back to
// anyone in the app (see reportsService.ts / migration 0004) -- there is no
// public feed of reports, only a moderation queue reviewed outside the app.
export const ReportUserScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const userId = route.params?.userId;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !userId) return;
    setLoading(true);
    setError(null);
    try {
      await reportsService.submitReport({ reportedUserId: userId, reason, details });
      haptics.success();
      setSent(true);
    } catch (e) {
      haptics.error();
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="Пожаловаться" onBack={() => navigation.goBack()} />

      {!userId ? (
        <ErrorState message="Не указан пользователь для жалобы." />
      ) : sent ? (
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sentTitle, { color: colors.text }]}>Жалоба отправлена</Text>
          <Text style={[styles.sentBody, { color: colors.textSecondary }]}>
            Спасибо, мы получили вашу жалобу. Она не публикуется и не видна вашему партнёру.
          </Text>
          <PrimaryButton label="Готово" onPress={() => navigation.goBack()} style={styles.doneButton} />
        </View>
      ) : (
        <View>
          {error && <ErrorState message={error} onRetry={handleSubmit} />}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Причина</Text>
          {REASONS.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setReason(r.key)}
              style={[
                styles.reasonRow,
                shadow.soft,
                { backgroundColor: colors.card, borderColor: reason === r.key ? colors.primary : colors.border },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: reason === r.key ? colors.primary : colors.border },
                  reason === r.key && { backgroundColor: colors.primary },
                ]}
              />
              <Text style={[styles.reasonLabel, { color: colors.text }]}>{r.label}</Text>
            </Pressable>
          ))}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Подробности (необязательно)</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Опишите, что произошло"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <PrimaryButton label="Отправить жалобу" onPress={handleSubmit} disabled={!reason} />
          )}
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginRight: spacing.md,
  },
  reasonLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
    textAlignVertical: 'top',
  },
  center: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  sentTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sentBody: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  doneButton: {
    width: '100%',
  },
});
