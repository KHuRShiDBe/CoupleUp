import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbNotification } from '../../types/database';

export const listNotifications = async (limit = 50): Promise<DbNotification[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new ServiceError(error.message);
  return (data as DbNotification[]) ?? [];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw new ServiceError(error.message);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw new ServiceError(error.message);
};
