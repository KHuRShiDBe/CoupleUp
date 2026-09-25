import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { PartnerNudgeButton } from '../../components/common/PartnerNudgeButton';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { usePlanning } from '../../store/PlanningContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Promises'>;

export const PromisesBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const planning = usePlanning();
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (!title.trim() || !sync.partner) return;
    haptics.confirm();
    planning.addPromise(title.trim());
    setTitle('');
  };

  const handleComplete = (id: string, promiseTitle: string) => {
    haptics.success();
    // complete_promise (migration 0016) does both the status transition and
    // the fixed-reward points award atomically server-side, guarded so a
    // double-tap/retry can never award the points twice.
    planning.completePromise(id, t('promises.historyTitle', { title: promiseTitle }));
  };

  const handleCancel = (id: string) => {
    haptics.select();
    planning.updatePromiseStatus(id, 'cancelled');
  };

  const nameFor = (userId: string) =>
    userId === auth.session?.user?.id ? t('promises.me') : sync.partner?.name ?? t('promises.partner');

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('promises.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <PrimaryButton label={t('promises.addButton')} onPress={handleAdd} disabled={!title.trim() || !sync.partner} />
        </View>

        {planning.promises.length === 0 ? (
          <EmptyState icon="notification" title={t('promises.emptyTitle')} description={t('promises.emptyDescription')} />
        ) : (
          planning.promises.map((p) => (
            <View key={p.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{p.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {t('promises.fromTo', { from: nameFor(p.from_user_id), to: nameFor(p.to_user_id) })}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {new Date(p.created_at).toLocaleDateString()} · {t(`promises.status_${p.status}`)}
              </Text>
              {p.status === 'active' && (
                <View style={styles.actionsRow}>
                  {/* Only the recipient (to_user_id) can confirm a promise was
                      kept -- mirrors reward_requests: the other party
                      confirms, never the person who made the promise. */}
                  {p.to_user_id === auth.session?.user?.id && (
                    <PrimaryButton
                      label={t('promises.complete')}
                      onPress={() => handleComplete(p.id, p.title)}
                      style={styles.actionButton}
                    />
                  )}
                  <PrimaryButton
                    label={t('promises.cancel')}
                    onPress={() => handleCancel(p.id)}
                    variant="outline"
                    style={styles.actionButton}
                  />
                </View>
              )}
              {p.status === 'active' && p.to_user_id === sync.partner?.id && (
                <PartnerNudgeButton entityType="promise" entityId={p.id} title={p.title} />
              )}
            </View>
          ))
        )}
      </ScrollView>
  );
};

export const PromisesScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('promises.title')} onBack={() => navigation.goBack()} />
      <PromisesBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  form: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 40,
  },
});
