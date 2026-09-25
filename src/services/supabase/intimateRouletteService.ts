import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbIntimateRouletteConsent, DbIntimateRouletteResult, DbIntimateRouletteSettings, IntimateRouletteAllowed } from '../../types/database';
import { generateRequestId } from '../../utils/requestId';

export interface IntimateSpinResult {
  resultKey: string;
  usedCoupon: boolean;
  costPoints: number;
  balanceAfter: number;
  couponsRemaining: number;
}

const DEFAULT_ALLOWED: IntimateRouletteAllowed = {
  tender: true,
  active: true,
  dominant: true,
  blindfold: true,
  bondage: true,
  roleplay: true,
};

export const listConsent = async (coupleId: string): Promise<DbIntimateRouletteConsent[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('intimate_roulette_consent').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbIntimateRouletteConsent[]) ?? [];
};

// Upsert-by-hand: the table has no unique-violation-free upsert route via
// RLS alone (insert vs update are two different policies), so try update
// first and insert only if no row existed yet.
export const setMyConsent = async (coupleId: string, userId: string, consented: boolean): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { data: existing, error: selectError } = await supabase
    .from('intimate_roulette_consent')
    .select('couple_id')
    .eq('couple_id', coupleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) throw new ServiceError(selectError.message);

  if (existing) {
    const { error } = await supabase
      .from('intimate_roulette_consent')
      .update({ consented, updated_at: new Date().toISOString() })
      .eq('couple_id', coupleId)
      .eq('user_id', userId);
    if (error) throw new ServiceError(error.message);
  } else {
    const { error } = await supabase.from('intimate_roulette_consent').insert({ couple_id: coupleId, user_id: userId, consented });
    if (error) throw new ServiceError(error.message);
  }
};

export const getSettings = async (coupleId: string): Promise<IntimateRouletteAllowed> => {
  if (!isSupabaseConfigured) return DEFAULT_ALLOWED;
  const { data, error } = await supabase
    .from('intimate_roulette_settings')
    .select('*')
    .eq('couple_id', coupleId)
    .maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbIntimateRouletteSettings | null)?.allowed ?? DEFAULT_ALLOWED;
};

export const updateSettings = async (coupleId: string, allowed: IntimateRouletteAllowed): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('intimate_roulette_settings')
    .upsert({ couple_id: coupleId, allowed, updated_at: new Date().toISOString() }, { onConflict: 'couple_id' });
  if (error) throw new ServiceError(error.message);
};

export const listResults = async (coupleId: string, limit = 5): Promise<DbIntimateRouletteResult[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('intimate_roulette_results')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new ServiceError(error.message);
  return (data as DbIntimateRouletteResult[]) ?? [];
};

// The server (spin_intimate_roulette, migration 0031) is the sole authority
// on payment -- it checks/debits BOND or consumes a coupon, and logs the
// result, all in one transaction. The specific result (resultKey) is still
// chosen client-side (see constants/intimateRoulette.ts) and just reported
// here -- nothing of economic value depends on which one it is, only on
// whether this spin was actually paid for.
export const spin = async (coupleId: string, resultKey: string, useCoupon: boolean): Promise<IntimateSpinResult> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('spin_intimate_roulette', {
    p_couple_id: coupleId,
    p_result_key: resultKey,
    p_use_coupon: useCoupon,
    p_client_request_id: generateRequestId(),
  });
  if (error) throw new ServiceError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    resultKey: row.result_key,
    usedCoupon: row.used_coupon,
    costPoints: row.cost_points,
    balanceAfter: row.balance_after,
    couponsRemaining: row.coupons_remaining,
  };
};

// Coupons are just wish_inventory rows (migration 0031) with a dedicated
// item_key -- no second inventory/balance system. Counted per-user (owner_id),
// never shared across the couple, even though the select-RLS on wish_inventory
// lets a member see their partner's rows too.
export const getCouponCount = async (userId: string): Promise<number> => {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from('wish_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('item_key', 'intimate_spin_coupon')
    .eq('status', 'available');
  if (error) throw new ServiceError(error.message);
  return count ?? 0;
};
