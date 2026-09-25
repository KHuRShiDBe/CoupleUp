import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as shopRouletteService from '../services/supabase/shopRouletteService';
import { ShopSpinResult } from '../services/supabase/shopRouletteService';
import { getCouponCount } from '../services/supabase/intimateRouletteService';
import { subscribeToShopRoulette } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbShopRouletteResult } from '../types/database';

interface ShopRouletteValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  results: DbShopRouletteResult[];
  couponCount: number;
  spin: (useCoupon: boolean) => Promise<ShopSpinResult | null>;
  refresh: () => Promise<void>;
}

const ShopRouletteContext = createContext<ShopRouletteValue | undefined>(undefined);

export const ShopRouletteProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DbShopRouletteResult[]>([]);
  const [couponCount, setCouponCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId || !userId) {
      setResults([]);
      setCouponCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [resultRows, coupons] = await Promise.all([
        shopRouletteService.listResults(coupleId),
        getCouponCount(userId),
      ]);
      setResults(resultRows);
      setCouponCount(coupons);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToShopRoulette(coupleId, { onResultsChange: refresh, onCouponsChange: refresh });
  }, [coupleId, refresh]);

  const value = useMemo<ShopRouletteValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      results,
      couponCount,
      spin: async (useCoupon: boolean) => {
        if (!coupleId) return null;
        setError(null);
        try {
          const result = await shopRouletteService.spin(coupleId, useCoupon);
          await refresh();
          return result;
        } catch (e) {
          const serviceError = toServiceError(e);
          // Shared exception name with the other two roulettes (same wording
          // would say "2 BOND", which is wrong here -- this wheel costs 10).
          setError(
            serviceError.code === 'ROULETTE_NOT_ENOUGH_BOND'
              ? 'Недостаточно BOND для вращения рулетки магазина. Нужно 10 BOND.'
              : friendlyMessage(serviceError),
          );
          return null;
        }
      },
      refresh,
    }),
    [loading, error, results, couponCount, coupleId, refresh],
  );

  return <ShopRouletteContext.Provider value={value}>{children}</ShopRouletteContext.Provider>;
};

export const useShopRoulette = (): ShopRouletteValue => {
  const ctx = useContext(ShopRouletteContext);
  if (!ctx) throw new Error('useShopRoulette must be used within ShopRouletteProvider');
  return ctx;
};
