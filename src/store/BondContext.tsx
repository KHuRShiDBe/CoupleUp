import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as bondService from '../services/supabase/bondService';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbBondRate } from '../types/database';
import { DEFAULT_POINTS_PER_BOND, bondToPoints, pointsToBond } from '../utils/bond';

interface BondContextValue {
  loading: boolean;
  error: string | null;
  // Current points-per-BOND rate -- falls back to the documented default
  // (100 points = 1 BOND) if Supabase isn't configured or has no rate row
  // yet, so the app never shows a broken/zero rate.
  pointsPerBond: number;
  history: DbBondRate[];
  toBond: (points: number) => number;
  toPoints: (bond: number) => number;
  refresh: () => Promise<void>;
}

const BondContext = createContext<BondContextValue | undefined>(undefined);

export const BondProvider = ({ children }: { children: React.ReactNode }) => {
  const [pointsPerBond, setPointsPerBond] = useState(DEFAULT_POINTS_PER_BOND);
  const [history, setHistory] = useState<DbBondRate[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [current, hist] = await Promise.all([bondService.getCurrentRate(), bondService.getRateHistory()]);
      if (current) setPointsPerBond(current.points_per_bond);
      setHistory(hist);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: a new rate row added anywhere (e.g. via the SQL editor) shows
  // up for both partners without restarting the app.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('bond-rates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bond_rates' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo<BondContextValue>(
    () => ({
      loading,
      error,
      pointsPerBond,
      history,
      toBond: (points: number) => pointsToBond(points, pointsPerBond),
      toPoints: (bond: number) => bondToPoints(bond, pointsPerBond),
      refresh,
    }),
    [loading, error, pointsPerBond, history, refresh],
  );

  return <BondContext.Provider value={value}>{children}</BondContext.Provider>;
};

export const useBond = (): BondContextValue => {
  const ctx = useContext(BondContext);
  if (!ctx) throw new Error('useBond must be used within BondProvider');
  return ctx;
};
