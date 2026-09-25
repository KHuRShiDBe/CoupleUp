import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbWishInventoryItem } from '../../types/database';

// "Мои накопления" -- personal roulette winnings only, never the partner's.
// wish_inventory's select-RLS is couple-wide (the partner needs to see what's
// owed/available), so the owner_id filter here is what actually keeps male
// and female winnings from mixing on screen -- not a second table, the same
// one both spin_wish_roulette and spin_shop_roulette already write to.
export const listMyInventory = async (userId: string): Promise<DbWishInventoryItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('wish_inventory')
    .select('*')
    .eq('owner_id', userId)
    .order('won_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbWishInventoryItem[]) ?? [];
};
