import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as wishRouletteService from '../services/supabase/wishRouletteService';
import { subscribeToWishRoulette } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbWishRouletteResult } from '../types/database';
import { WishSpinResult } from '../services/supabase/wishRouletteService';

interface WishRouletteValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  results: DbWishRouletteResult[];
  spin: (gender: 'male' | 'female') => Promise<WishSpinResult | null>;
  refresh: () => Promise<void>;
}

const WishRouletteContext = createContext<WishRouletteValue | undefined>(undefined);

export const WishRouletteProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DbWishRouletteResult[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId || !userId) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await wishRouletteService.listResults(coupleId));
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
    return subscribeToWishRoulette(coupleId, { onResultsChange: refresh });
  }, [coupleId, refresh]);

  const value = useMemo<WishRouletteValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      results,
      spin: async (gender: 'male' | 'female') => {
        if (!coupleId) return null;
        setError(null);
        try {
          const result = await wishRouletteService.spin(coupleId, gender);
          await refresh();
          return result;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return null;
        }
      },
      refresh,
    }),
    [loading, error, results, coupleId, refresh],
  );

  return <WishRouletteContext.Provider value={value}>{children}</WishRouletteContext.Provider>;
};

export const useWishRoulette = (): WishRouletteValue => {
  const ctx = useContext(WishRouletteContext);
  if (!ctx) throw new Error('useWishRoulette must be used within WishRouletteProvider');
  return ctx;
};
