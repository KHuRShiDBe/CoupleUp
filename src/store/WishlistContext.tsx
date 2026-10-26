import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as wishlistService from '../services/supabase/wishlistService';
import { subscribeToWishlist } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbWishlistItem } from '../types/database';
import { WishlistPriority } from '../types';

interface WishlistValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  items: DbWishlistItem[];
  // Resolves true only once the row is saved; false if there is no couple
  // yet or the insert failed (error is then set).
  addItem: (input: { title: string; priceUsd?: number; priority: WishlistPriority }) => Promise<boolean>;
  removeItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistValue | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DbWishlistItem[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await wishlistService.listWishlistItems(coupleId);
      setItems(rows);
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
    return subscribeToWishlist(coupleId, refresh);
  }, [coupleId, refresh]);

  const value = useMemo<WishlistValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      items,
      addItem: async (input) => {
        if (!coupleId || !userId) return false;
        setError(null);
        try {
          const row = await wishlistService.addWishlistItem({ coupleId, createdBy: userId, ...input });
          // Realtime may already have refreshed the list with this row.
          setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      removeItem: async (id: string) => {
        setError(null);
        try {
          await wishlistService.removeWishlistItem(id);
          setItems((prev) => prev.filter((i) => i.id !== id));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [loading, error, items, coupleId, userId, refresh],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = (): WishlistValue => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
};
