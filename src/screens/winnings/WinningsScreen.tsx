import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { listCoupleInventory, requestUseInventoryItem, respondInventoryUse } from '../../services/supabase/savingsService';
import { subscribeToCoupleInventory } from '../../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { DbWishInventoryItem, WishInventoryStatus } from '../../types/database';
import { formatRelativeTime } from '../../utils/date';
import { haptics } from '../../utils/haptics';
import { COUPON_ITEM_KEY, resolveItemTitle } from '../../utils/inventory';

type Props = NativeStackScreenProps<RootStackParamList, 'Savings'>;

const STATUS_LABEL_KEY: Record<WishInventoryStatus, TranslationKey> = {
  available: 'winnings.statusAvailable',
  pending_use: 'winnings.statusPending',
  used: 'winnings.statusUsed',
};

export const WinningsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const userId = auth.session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [items, setItems] = useState<DbWishInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useTarget, setUseTarget] = useState<DbWishInventoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!coupleId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await listCoupleInventory(coupleId));
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToCoupleInventory(coupleId, refresh);
  }, [coupleId, refresh]);

  const myItems = items.filter((i) => i.owner_id === userId && i.item_key !== COUPON_ITEM_KEY);
  const couponCount = items.filter((i) => i.owner_id === userId && i.item_key === COUPON_ITEM_KEY && i.status === 'available').length;
  // Items my partner won and has asked to use -- only I (never they) may confirm.
  const partnerRequests = items.filter((i) => i.owner_id !== userId && i.status === 'pending_use');

  const confirmUse = () => {
    if (!useTarget) return;
    const item = useTarget;
    setUseTarget(null);
    haptics.select();
    setBusyId(item.id);
    requestUseInventoryItem(item.id)
      .then(refresh)
      .catch((e) => setError(friendlyMessage(toServiceError(e))))
      .finally(() => setBusyId(null));
  };

  const respond = (item: DbWishInventoryItem, accept: boolean) => {
    haptics.select();
    setBusyId(item.id);
    respondInventoryUse(item.id, accept)
      .then(() => {
        if (accept) haptics.success();
        refresh();
      })
      .catch((e) => setError(friendlyMessage(toServiceError(e))))
      .finally(() => setBusyId(null));
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('winnings.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!error && <BackendStatusBanner message={error} onRetry={refresh} />}

        <View style={[styles.infoCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.infoLine, { color: colors.text }]}>{t('winnings.couponsLabel', { count: couponCount })}</Text>
        </View>

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {partnerRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('winnings.partnerRequestsTitle')}</Text>
                {partnerRequests.map((item) => (
                  <View key={item.id} style={[styles.itemRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                    <View style={styles.itemBody}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{resolveItemTitle(item.item_key, t)}</Text>
                      <Text style={[styles.itemTime, { color: colors.textSecondary }]}>{formatRelativeTime(item.requested_at ?? item.won_at)}</Text>
                    </View>
                    <View style={styles.actionsRow}>
                      <PrimaryButton
                        label={t('winnings.confirm')}
                        onPress={() => respond(item, true)}
                        disabled={busyId === item.id}
                        loading={busyId === item.id}
                        style={styles.actionButton}
                      />
                      <PrimaryButton
                        label={t('winnings.decline')}
                        onPress={() => respond(item, false)}
                        disabled={busyId === item.id}
                        variant="outline"
                        style={styles.actionButton}
                      />
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('winnings.itemsTitle')}</Text>
            {myItems.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('winnings.empty')}</Text>
            ) : (
              myItems.map((item) => (
                <View key={item.id} style={[styles.itemRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{resolveItemTitle(item.item_key, t)}</Text>
                    <Text style={[styles.itemTime, { color: colors.textSecondary }]}>{formatRelativeTime(item.won_at)}</Text>
                  </View>
                  {item.status === 'available' ? (
                    <PrimaryButton
                      label={t('winnings.use')}
                      onPress={() => setUseTarget(item)}
                      disabled={busyId === item.id}
                      loading={busyId === item.id}
                      style={styles.useButton}
                    />
                  ) : (
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: item.status === 'pending_use' ? colors.primary : colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: item.status === 'pending_use' ? colors.textOnPrimary : colors.textSecondary },
                        ]}
                      >
                        {t(STATUS_LABEL_KEY[item.status])}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={!!useTarget}
        title={t('winnings.useConfirmTitle')}
        message={t('winnings.useConfirmMessage')}
        confirmLabel={t('winnings.use')}
        onConfirm={confirmUse}
        onCancel={() => setUseTarget(null)}
      />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  infoCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  infoLine: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  empty: {
    fontSize: fontSize.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemTime: {
    fontSize: fontSize.xs,
  },
  statusBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  useButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
});
