import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';
import { listCoupleInventory, respondInventoryUse } from '../../services/supabase/savingsService';
import { subscribeToCoupleInventory } from '../../services/supabase/realtime';
import { DbWishInventoryItem } from '../../types/database';
import { resolveItemTitle } from '../../utils/inventory';
import { haptics } from '../../utils/haptics';

// App-wide overlay: "Партнёр использовал: <prize>" + OK, shown to whichever
// partner did NOT use the prize, for every wish_inventory row of theirs in
// 'pending_use'. It is driven by the row's server status, not by a push, so
// it also appears on the next app open if this phone was offline. OK calls
// the existing respond_inventory_use(accept) -> 'used'; the server only
// accepts that from 'pending_use', so a prize can never be used twice.
export const PartnerPrizeUseModal = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const userId = auth.session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [queue, setQueue] = useState<DbWishInventoryItem[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!auth.configured || !coupleId || !userId) {
      setQueue([]);
      return;
    }
    try {
      const rows = await listCoupleInventory(coupleId);
      setQueue(rows.filter((r) => r.owner_id !== userId && r.status === 'pending_use'));
    } catch {
      // Silent: the Winnings screen still lists these and shows errors.
    }
  }, [auth.configured, coupleId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Own channel name -- the Winnings screen subscribes to the same table.
  useEffect(() => {
    if (!coupleId) return;
    return subscribeToCoupleInventory(coupleId, refresh, 'prize-use-overlay');
  }, [coupleId, refresh]);

  // Catch up when the app returns to the foreground (was offline/backgrounded).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const current = queue[0];

  const handleOk = async () => {
    if (!current || busy) return;
    setBusy(true);
    haptics.confirm();
    try {
      await respondInventoryUse(current.id, true);
    } catch {
      // Already handled elsewhere (e.g. confirmed on the Winnings screen) --
      // the refresh below drops it from the queue either way.
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={styles.emoji}>🎁</Text>
          <Text style={[styles.important, { color: colors.danger }]}>{t('winnings.partnerUsedImportant')}</Text>
          <Text style={[styles.title, { color: colors.textSecondary }]}>{t('winnings.partnerUsedTitle')}</Text>
          {!!current && (
            <Text style={[styles.prize, { color: colors.text }]}>{resolveItemTitle(current.item_key, t)}</Text>
          )}
          <PrimaryButton label={t('winnings.partnerUsedOk')} onPress={handleOk} loading={busy} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 2,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  important: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  prize: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    minHeight: 56,
  },
});
