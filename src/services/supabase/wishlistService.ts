import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbWishlistItem } from '../../types/database';
import { WishlistPriority } from '../../types';

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
  priority: WishlistPriority;
}): Promise<DbWishlistItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({
      couple_id: input.coupleId,
      created_by: input.createdBy,
      title: input.title,
      price_usd: input.priceUsd,
      priority: input.priority,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbWishlistItem;
};

export const removeWishlistItem = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) throw new ServiceError(error.message);
};
