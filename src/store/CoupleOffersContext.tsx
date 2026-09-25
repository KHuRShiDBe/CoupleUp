import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as coupleOffersService from '../services/supabase/coupleOffersService';
import { subscribeToCoupleOffers } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbCoupleOffer, DbCoupleOfferCounter } from '../types/database';

interface CoupleOffersValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  offers: DbCoupleOffer[];
  counters: DbCoupleOfferCounter[];
  createOffer: (title: string, pricePoints: number, deadlineIso?: string | null) => Promise<boolean>;
  respondOffer: (offerId: string, accept: boolean) => Promise<boolean>;
  proposeCounter: (offerId: string, pricePoints: number, note?: string) => Promise<boolean>;
  respondCounter: (counterId: string, accept: boolean) => Promise<boolean>;
  completeAgreement: (offerId: string) => Promise<boolean>;
  failAgreementPenalty: (offerId: string, multiplier: number) => Promise<boolean>;
  requestCancelAgreement: (offerId: string) => Promise<boolean>;
  respondCancelAgreement: (offerId: string, accept: boolean) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const CoupleOffersContext = createContext<CoupleOffersValue | undefined>(undefined);

export const CoupleOffersProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<DbCoupleOffer[]>([]);
  const [counters, setCounters] = useState<DbCoupleOfferCounter[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setOffers([]);
      setCounters([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [o, c] = await Promise.all([
        coupleOffersService.listCoupleOffers(coupleId),
        coupleOffersService.listCoupleOfferCounters(coupleId),
      ]);
      setOffers(o);
      setCounters(c);
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
    return subscribeToCoupleOffers(coupleId, {
      onOffersChange: refresh,
      onCountersChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<CoupleOffersValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      offers,
      counters,
      createOffer: async (title, pricePoints, deadlineIso) => {
        if (!coupleId || !userId) return false;
        setError(null);
        try {
          await coupleOffersService.createCoupleOffer({ coupleId, createdBy: userId, title, pricePoints, deadlineIso });
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      respondOffer: async (offerId, accept) => {
        setError(null);
        try {
          await coupleOffersService.respondCoupleOffer(offerId, accept);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      proposeCounter: async (offerId, pricePoints, note) => {
        setError(null);
        try {
          await coupleOffersService.proposeCoupleOfferCounter(offerId, pricePoints, note);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      respondCounter: async (counterId, accept) => {
        setError(null);
        try {
          await coupleOffersService.respondCoupleOfferCounter(counterId, accept);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      completeAgreement: async (offerId) => {
        setError(null);
        try {
          await coupleOffersService.completeAgreement(offerId);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      failAgreementPenalty: async (offerId, multiplier) => {
        setError(null);
        try {
          await coupleOffersService.failAgreementPenalty(offerId, multiplier);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      requestCancelAgreement: async (offerId) => {
        setError(null);
        try {
          await coupleOffersService.requestCancelAgreement(offerId);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      respondCancelAgreement: async (offerId, accept) => {
        setError(null);
        try {
          await coupleOffersService.respondCancelAgreement(offerId, accept);
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      refresh,
    }),
    [loading, error, offers, counters, coupleId, userId, refresh],
  );

  return <CoupleOffersContext.Provider value={value}>{children}</CoupleOffersContext.Provider>;
};

export const useCoupleOffers = (): CoupleOffersValue => {
  const ctx = useContext(CoupleOffersContext);
  if (!ctx) throw new Error('useCoupleOffers must be used within CoupleOffersProvider');
  return ctx;
};
