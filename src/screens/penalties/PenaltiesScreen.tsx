import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'Penalties'>;

const PENALTY_TYPES = [
  { id: 'late', title: 'Опоздал', points: 10 },
  { id: 'promise', title: 'Забыл обещание', points: 20 },
  { id: 'rude', title: 'Был груб', points: 30 },
  { id: 'cancel', title: 'Отменил планы без предупреждения', points: 25 },
];

export const PenaltiesScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const myId = auth.session?.user?.id ?? null;
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [customTitle, setCustomTitle] = useState('');
  const [customPoints, setCustomPoints] = useState('10');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pending = sync.penalties.filter((p) => p.status === 'pending');
  const confirmed = sync.penalties.filter((p) => p.status === 'confirmed');

  const openConfirm = (title: string, points: number) => {
    setPendingTitle(title);
    setPendingPoints(points);
  };

  const closeConfirm = () => setPendingTitle(null);

  const sendForConfirmation = async () => {
    if (!pendingTitle || submitting) return;
    setSubmitting(true);
    try {
      await sync.createPenalty({ title: pendingTitle, points: pendingPoints });
      setShowCustomForm(false);
      closeConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  const submitCustom = () => {
    if (!customTitle.trim()) return;
    openConfirm(customTitle.trim(), Math.abs(parseInt(customPoints, 10) || 0));
  };

  if (!auth.configured) {
    return (
      <ScreenBackground>
        <ScreenContainer transparent>
          <ScreenHeader title="Штрафы" onBack={() => navigation.goBack()} />
          <ErrorState message={t('activityCenter.notConfigured')} />
        </ScreenContainer>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      {sync.loading && sync.penalties.length === 0 ? (
        <ScreenContainer transparent>
          <ScreenHeader title="Штрафы" onBack={() => navigation.goBack()} />
          <LoadingState />
        </ScreenContainer>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ScreenHeader title="Штрафы" onBack={() => navigation.goBack()} />
          {!!sync.error && <BackendStatusBanner message={sync.error} onRetry={sync.clearError} />}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Штраф начисляется только после подтверждения партнёром.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Виды штрафов</Text>
          {PENALTY_TYPES.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => openConfirm(p.title, p.points)}
              style={[styles.chip, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.chipTitle, { color: colors.text }]}>{p.title}</Text>
              <Text style={[styles.chipPoints, { color: colors.danger }]}>-{p.points}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowCustomForm((v) => !v)}
            style={[
              styles.chip,
              shadow.soft,
              { backgroundColor: showCustomForm ? colors.background : colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.chipTitle, { color: colors.text }]}>Пользовательский штраф</Text>
          </Pressable>

          {showCustomForm && (
            <View style={styles.customBox}>
              <TextInput
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="Название штрафа"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
              />
              <TextInput
                value={customPoints}
                onChangeText={(v) => setCustomPoints(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Баллы"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
              />
              <PrimaryButton label="Отправить на подтверждение" onPress={submitCustom} disabled={!customTitle.trim()} />
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.lg }]}>
            Ожидают подтверждения
          </Text>
          {pending.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>Нет штрафов на подтверждении</Text>
          ) : (
            pending.map((p) => (
              <View key={p.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{p.title}</Text>
                  <Text style={[styles.cardPoints, { color: colors.danger }]}>-{p.points}</Text>
                </View>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {p.created_by === myId ? 'Ожидает подтверждения партнёра' : 'Требуется ваше подтверждение'}
                </Text>
                {/* Only the target (not the creator) may confirm/decline --
                    server-side respond_penalty also rejects self-confirmation
                    (CANNOT_SELF_CONFIRM), this just avoids showing a button
                    that would always fail for whoever created it. */}
                {p.created_by !== myId && (
                  <View style={styles.cardActionsRow}>
                    <PrimaryButton
                      label="Подтвердить"
                      onPress={() => sync.respondPenalty(p.id, true)}
                      style={styles.cardActionButton}
                    />
                    <PrimaryButton
                      label="Отклонить"
                      onPress={() => sync.respondPenalty(p.id, false)}
                      variant="outline"
                      style={styles.cardActionButton}
                    />
                  </View>
                )}
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.lg }]}>Подтверждено</Text>
          {confirmed.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>Подтверждённых штрафов пока нет</Text>
          ) : (
            confirmed.map((p) => (
              <View
                key={p.id}
                style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.7 }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{p.title}</Text>
                  <Text style={[styles.cardPoints, { color: colors.textSecondary }]}>-{p.points}</Text>
                </View>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Подтверждено</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={!!pendingTitle} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{pendingTitle}</Text>
            <Text style={[styles.modalPoints, { color: colors.danger }]}>-{pendingPoints} баллов</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Партнёр должен подтвердить этот штраф, прежде чем баллы будут списаны.
            </Text>
            <PrimaryButton
              label="Отправить на подтверждение"
              onPress={sendForConfirmation}
              disabled={submitting}
              loading={submitting}
              style={styles.modalButton}
            />
            <PrimaryButton label="Отмена" onPress={closeConfirm} variant="outline" />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chipTitle: {
    fontWeight: '600',
    fontSize: fontSize.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  chipPoints: {
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  customBox: {
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
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  cardPoints: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  cardButton: {
    height: 44,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardActionButton: {
    flex: 1,
    height: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalPoints: {
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalButton: {
    marginBottom: spacing.sm,
  },
});
