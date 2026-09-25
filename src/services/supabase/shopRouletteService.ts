import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbShopRouletteResult } from '../../types/database';
import { generateRequestId } from '../../utils/requestId';

export interface ShopSpinResult {
  itemKey: string;
  usedCoupon: boolean;
  costPoints: number;
  balanceAfter: number;
  couponsRemaining: number;
}

export const listResults = async (coupleId: string, limit = 5): Promise<DbShopRouletteResult[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('shop_roulette_results')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new ServiceError(error.message);
  return (data as DbShopRouletteResult[]) ?? [];
};

// The server (spin_shop_roulette, migration 0032) is the sole authority on
// both payment AND the winning sector -- unlike intimate roulette, the
// client never picks its own result here, only animates to whatever index
// the returned item_key maps to (see ShopRouletteScreen).
export const spin = async (coupleId: string, useCoupon: boolean): Promise<ShopSpinResult> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('spin_shop_roulette', {
    p_couple_id: coupleId,
    p_use_coupon: useCoupon,
    p_client_request_id: generateRequestId(),
  });
  if (error) throw new ServiceError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    itemKey: row.item_key,
    usedCoupon: row.used_coupon,
    costPoints: row.cost_points,
    balanceAfter: row.balance_after,
    couponsRemaining: row.coupons_remaining,
  };
};
