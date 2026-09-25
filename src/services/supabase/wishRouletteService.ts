import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbWishRouletteResult } from '../../types/database';
import { generateRequestId } from '../../utils/requestId';

export interface WishSpinResult {
  itemKey: string;
  valuePoints: number;
  costPoints: number;
  balanceAfter: number;
}

export const listResults = async (coupleId: string, limit = 10): Promise<DbWishRouletteResult[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('wish_roulette_results')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new ServiceError(error.message);
  return (data as DbWishRouletteResult[]) ?? [];
};

// The server (spin_wish_roulette) is the sole authority on the outcome --
// balance check, weighted draw, and both ledger writes all happen inside
// that one security-definer RPC. This just calls it and returns its result.
export const spin = async (coupleId: string, gender: 'male' | 'female'): Promise<WishSpinResult> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  // Idempotency key: a fresh id per call -- if this exact request is ever
  // replayed (transport-level retry), the RPC recognizes it and returns the
  // original result instead of spinning/charging a second time.
  const { data, error } = await supabase.rpc('spin_wish_roulette', {
    p_couple_id: coupleId,
    p_gender: gender,
    p_client_request_id: generateRequestId(),
  });
  if (error) throw new ServiceError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    itemKey: row.item_key,
    valuePoints: row.value_points,
    costPoints: row.cost_points,
    balanceAfter: row.balance_after,
  };
};
