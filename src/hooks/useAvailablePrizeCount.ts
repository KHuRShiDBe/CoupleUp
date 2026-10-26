import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { useCoupleSync } from '../store/CoupleSyncContext';
import { listCoupleInventory } from '../services/supabase/savingsService';
import { subscribeToCoupleInventory } from '../services/supabase/realtime';
import { COUPON_ITEM_KEY } from '../utils/inventory';

// Number of my own roulette prizes still 'available' (coupons excluded --
// they are counted on the roulette screen). Updates live on win / use via
// realtime, and when the app returns to the foreground.
export const useAvailablePrizeCount = (): number => {
  const auth = useAuth();
  const sync = useCoupleSync();
  const userId = auth.session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!auth.configured || !coupleId || !userId) {
      setCount(0);
      return;
    }
    try {
      const rows = await listCoupleInventory(coupleId);
      setCount(rows.filter((r) => r.owner_id === userId && r.status === 'available' && r.item_key !== COUPON_ITEM_KEY).length);
    } catch {
      // Keep the last known count; the Winnings screen surfaces errors.
    }
  }, [auth.configured, coupleId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Own channel name -- other screens subscribe to the same table.
  useEffect(() => {
    if (!coupleId) return;
    return subscribeToCoupleInventory(coupleId, refresh, 'home-prize-count');
  }, [coupleId, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return count;
};
