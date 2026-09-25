import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbBondRate } from '../../types/database';

// Global (not couple-scoped) points-per-BOND exchange rate, see migration
// 0008. Read-only from the client -- a new rate is added directly in
// Supabase; there is no write path here.
export const getCurrentRate = async (): Promise<DbBondRate | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('bond_rates')
    .select('*')
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbBondRate) ?? null;
};

// Defaults to 52 rows -- one per week, a year of history, matching
// BondRateScreen's "52 недели" requirement without pulling unbounded rows.
export const getRateHistory = async (limit = 52): Promise<DbBondRate[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('bond_rates')
    .select('*')
    .order('effective_from', { ascending: false })
    .limit(limit);
  if (error) throw new ServiceError(error.message);
  return (data as DbBondRate[]) ?? [];
};
