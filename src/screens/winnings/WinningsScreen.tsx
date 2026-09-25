import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { useAuth } from '../../store/AuthContext';
import { listMyInventory } from '../../services/supabase/savingsService';
import { subscribeToSavings } from '../../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { DbWishInventoryItem, WishInventoryStatus } from '../../types/database';
import { formatRelativeTime } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Savings'>;

const COUPON_ITEM_KEY = 'intimate_spin_coupon';

const STATUS_LABEL_KEY: Record<WishInventoryStatus, TranslationKey> = {
  available: 'winnings.statusAvailable',
  pending_use: 'winnings.statusPending',
  used: 'winnings.statusUsed',
};

// Resolves an inventory row's title from whichever wheel actually won it --
// nothing is renamed or duplicated, this just picks the right existing
// translation namespace for the item_key already stored on the row.
const resolveItemTitle = (itemKey: string, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string => {
  if (itemKey === COUPON_ITEM_KEY) return t('winnings.couponItemLabel');
  if (itemKey.startsWith('shop_')) return t(`shopRoulette.item_${itemKey}` as TranslationKey);
  return t(`wishRoulette.item_${itemKey}` as TranslationKey);
};

export const WinningsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const userId = auth.session?.user?.id ?? null;

  const [items, setItems] = useState<DbWishInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await listMyInventory(userId));
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToSavings(userId, refresh);
  }, [userId, refresh]);

  const couponCount = items.filter((i) => i.item_key === COUPON_ITEM_KEY && i.status === 'available').length;
  const wonItems = items.filter((i) => i.item_key !== COUPON_ITEM_KEY);

  return (
    <ScreenContainer>
      <ScreenHeader title={t('winnings.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!error && <BackendStatusBanner message={error} onRetry={refresh} />}

        <View style={[styles.infoCard, shadow.soft, { backgroundColor: colors.primary }]}>
          <Text style={[styles.infoLine, { color: '#FFFFFF' }]}>{t('winnings.couponsLabel', { count: couponCount })}</Text>
        </View>

        {loading ? (
          <LoadingState />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('winnings.itemsTitle')}</Text>
            {wonItems.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('winnings.empty')}</Text>
            ) : (
              wonItems.map((item) => (
                <View key={item.id} style={[styles.itemRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{resolveItemTitle(item.item_key, t)}</Text>
                    <Text style={[styles.itemTime, { color: colors.textSecondary }]}>{formatRelativeTime(item.won_at)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.status === 'available' ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: item.status === 'available' ? colors.textOnPrimary : colors.textSecondary }]}>
                      {t(STATUS_LABEL_KEY[item.status])}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
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
});
