import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbBoardItem, DbBoardItemInsert } from '../../types/database';

// Shared couple board (migration 0050): one row per finished action.

export const listBoardItems = async (coupleId: string): Promise<DbBoardItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('couple_board_items')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true });
  if (error) throw new ServiceError(error.message);
  return (data as DbBoardItem[]) ?? [];
};

export const addBoardItem = async (item: DbBoardItemInsert): Promise<DbBoardItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.from('couple_board_items').insert(item).select().single();
  if (error) throw new ServiceError(error.message);
  return data as DbBoardItem;
};

// Undo: RLS only lets you delete your own items.
export const deleteBoardItem = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('couple_board_items').delete().eq('id', id);
  if (error) throw new ServiceError(error.message);
};

export const clearBoard = async (coupleId: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('clear_couple_board', { p_couple_id: coupleId });
  if (error) throw new ServiceError(error.message);
};
