import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbWishInventoryItem } from '../../types/database';

// "Мои накопления" now shows both sides: my own won items AND any item of
// my partner's that's `pending_use` and needs MY confirmation (see
// respondInventoryUse below) -- so this fetches the whole couple's rows,
// not just owner_id = me. wish_inventory's select-RLS is already couple-wide
// (public.is_couple_member), the same table both spin_wish_roulette and
// spin_shop_roulette write to -- no second table.
export const listCoupleInventory = async (coupleId: string): Promise<DbWishInventoryItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('wish_inventory')
    .select('*')
    .eq('couple_id', coupleId)
    .order('won_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbWishInventoryItem[]) ?? [];
};

// Activates a saved ('available') item -- owner only (enforced server-side).
// Does NOT mark it 'used' directly: it moves to 'pending_use' and waits for
// the partner to confirm via respondInventoryUse, same as reward requests /
// penalties elsewhere in the app. No BOND is charged or re-charged here --
// the item was already paid for when it was won.
export const requestUseInventoryItem = async (itemId: string): Promise<DbWishInventoryItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('request_use_inventory_item', { p_item_id: itemId });
  if (error) throw new ServiceError(error.message);
  return (Array.isArray(data) ? data[0] : data) as DbWishInventoryItem;
};

// Only the PARTNER (never the item's owner) may call this -- the server
// (migration 0027) raises CANNOT_SELF_CONFIRM otherwise. Accept sets
// status='used' + used_at=now(); decline returns it to 'available' so it can
// be requested again later.
export const respondInventoryUse = async (itemId: string, accept: boolean): Promise<DbWishInventoryItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_inventory_use', { p_item_id: itemId, p_accept: accept });
  if (error) throw new ServiceError(error.message);
  return (Array.isArray(data) ? data[0] : data) as DbWishInventoryItem;
};
