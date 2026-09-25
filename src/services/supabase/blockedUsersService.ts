import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

export interface BlockedUserRow {
  blocked_user_id: string;
  created_at: string;
}

// Deliberately not surfaced on any main screen -- only reachable from
// Settings ("Заблокированные пользователи") and the Account/couple flow
// ("Заблокировать партнёра"), per spec.
export const blockUser = async (blockedUserId: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ServiceError('Не авторизован');
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: auth.user.id, blocked_user_id: blockedUserId });
  if (error) throw new ServiceError(error.message);
};

export const unblockUser = async (blockedUserId: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', auth.user.id)
    .eq('blocked_user_id', blockedUserId);
  if (error) throw new ServiceError(error.message);
};

export const listBlockedUsers = async (): Promise<BlockedUserRow[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_user_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as BlockedUserRow[]) ?? [];
};
