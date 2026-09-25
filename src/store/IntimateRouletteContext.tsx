import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as intimateRouletteService from '../services/supabase/intimateRouletteService';
import { IntimateSpinResult } from '../services/supabase/intimateRouletteService';
import { subscribeToIntimateRoulette } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbIntimateRouletteResult, IntimateRouletteAllowed } from '../types/database';

const DEFAULT_ALLOWED: IntimateRouletteAllowed = {
  tender: true,
  active: true,
  dominant: true,
  blindfold: true,
  bondage: true,
  roleplay: true,
};

interface IntimateRouletteValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  myConsent: boolean;
  partnerConsent: boolean;
  bothConsented: boolean;
  allowed: IntimateRouletteAllowed;
  results: DbIntimateRouletteResult[];
  couponCount: number;
  setMyConsent: (consented: boolean) => Promise<void>;
  updateAllowed: (allowed: IntimateRouletteAllowed) => Promise<void>;
  spin: (resultKey: string, useCoupon: boolean) => Promise<IntimateSpinResult | null>;
  refresh: () => Promise<void>;
}

const IntimateRouletteContext = createContext<IntimateRouletteValue | undefined>(undefined);

export const IntimateRouletteProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;
  const partnerId = sync.partner?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myConsent, setMyConsentState] = useState(false);
  const [partnerConsent, setPartnerConsentState] = useState(false);
  const [allowed, setAllowed] = useState<IntimateRouletteAllowed>(DEFAULT_ALLOWED);
  const [results, setResults] = useState<DbIntimateRouletteResult[]>([]);
  const [couponCount, setCouponCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId || !userId) {
      setMyConsentState(false);
      setPartnerConsentState(false);
      setAllowed(DEFAULT_ALLOWED);
      setResults([]);
      setCouponCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [consentRows, allowedRows, resultRows, coupons] = await Promise.all([
        intimateRouletteService.listConsent(coupleId),
        intimateRouletteService.getSettings(coupleId),
        intimateRouletteService.listResults(coupleId, 5),
        intimateRouletteService.getCouponCount(userId),
      ]);
      setMyConsentState(consentRows.find((c) => c.user_id === userId)?.consented ?? false);
      setPartnerConsentState(partnerId ? consentRows.find((c) => c.user_id === partnerId)?.consented ?? false : false);
      setAllowed(allowedRows);
      setResults(resultRows);
      setCouponCount(coupons);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId, userId, partnerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToIntimateRoulette(coupleId, {
      onConsentChange: refresh,
      onSettingsChange: refresh,
      onResultsChange: refresh,
      onCouponsChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<IntimateRouletteValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      myConsent,
      partnerConsent,
      bothConsented: myConsent && partnerConsent,
      allowed,
      results,
      couponCount,
      setMyConsent: async (consented: boolean) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          await intimateRouletteService.setMyConsent(coupleId, userId, consented);
          setMyConsentState(consented);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      updateAllowed: async (next: IntimateRouletteAllowed) => {
        if (!coupleId) return;
        setError(null);
        try {
          await intimateRouletteService.updateSettings(coupleId, next);
          setAllowed(next);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      spin: async (resultKey: string, useCoupon: boolean) => {
        if (!coupleId) return null;
        setError(null);
        try {
          const result = await intimateRouletteService.spin(coupleId, resultKey, useCoupon);
          await refresh();
          return result;
        } catch (e) {
          const serviceError = toServiceError(e);
          // Shared exception name with the wish roulette (same wording would
          // say "2 BOND", which is wrong here -- this wheel costs 10).
          setError(
            serviceError.code === 'ROULETTE_NOT_ENOUGH_BOND'
              ? 'Недостаточно BOND для вращения интимной рулетки. Нужно 10 BOND.'
              : friendlyMessage(serviceError),
          );
          return null;
        }
      },
      refresh,
    }),
    [loading, error, myConsent, partnerConsent, allowed, results, couponCount, coupleId, userId, refresh],
  );

  return <IntimateRouletteContext.Provider value={value}>{children}</IntimateRouletteContext.Provider>;
};

export const useIntimateRoulette = (): IntimateRouletteValue => {
  const ctx = useContext(IntimateRouletteContext);
  if (!ctx) throw new Error('useIntimateRoulette must be used within IntimateRouletteProvider');
  return ctx;
};
