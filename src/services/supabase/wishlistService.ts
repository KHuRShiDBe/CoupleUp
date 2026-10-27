import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbWishlistItem } from '../../types/database';

export const listWishlistItems = async (coupleId: string): Promise<DbWishlistItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbWishlistItem[]) ?? [];
};

export const addWishlistItem = async (input: {
  coupleId: string;
  createdBy: string;
  title: string;
  priceUsd?: number;
  // 1 = one hour, 24 = one day, null = no deadline (migration 0048).
  deadlineHours: number | null;
  // Idempotency key: a retried request returns the same wish and never
  // charges the deadline surcharge twice (migration 0049).
  clientRequestId: string;
}): Promise<DbWishlistItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  // create_wish inserts the wish and debits the one-time deadline surcharge
  // (1 h: 50 points, 24 h: 20 points, none: free) in one transaction.
  const { data, error } = await supabase.rpc('create_wish', {
    p_couple_id: input.coupleId,
    p_title: input.title,
    p_price_usd: input.priceUsd ?? null,
    p_deadline_hours: input.deadlineHours,
    p_client_request_id: input.clientRequestId,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbWishlistItem;
};

export const removeWishlistItem = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) throw new ServiceError(error.message);
};

// Migration 0045. The partner (not the author) marks an active wish as done;
// it then waits for the author's confirmation. No BOND / points involved.
export const requestWishCompletion = async (id: string): Promise<DbWishlistItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('request_wish_completion', { p_item_id: id });
  if (error) throw new ServiceError(error.message);
  return data as DbWishlistItem;
};

// Author confirms (-> 'done', kept as history) or declines (-> 'active').
export const respondWishCompletion = async (id: string, approve: boolean): Promise<DbWishlistItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_wish_completion', { p_item_id: id, p_approve: approve });
  if (error) throw new ServiceError(error.message);
  return data as DbWishlistItem;
};

// Migration 0048/0049: the author marks their own active wish as important
// for a fixed 0.5 BOND (debited once by the server; anti-abuse limits enforced there).
export const makeWishImportant = async (id: string): Promise<DbWishlistItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('make_wish_important', { p_item_id: id });
  if (error) throw new ServiceError(error.message);
  return data as DbWishlistItem;
};

// Partner pressed OK on the important-wish window (read receipt only).
export const acknowledgeWishImportant = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('acknowledge_wish_important', { p_item_id: id });
  if (error) throw new ServiceError(error.message);
};
