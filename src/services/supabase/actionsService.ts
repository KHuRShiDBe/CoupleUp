import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbAction } from '../../types/database';

export const listActions = async (coupleId: string): Promise<DbAction[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbAction[]) ?? [];
};

// Logs an action and atomically applies its points to the couple's balance
// (RPC: apply_action). recipientId defaults server-side to the caller --
// pass the partner's id to credit them instead (e.g. logging something they
// did for you). type defaults to 'action' server-side; pass 'compliment' for
// the Compliments feature so it can be counted separately in History/stats,
// or 'reward_chest' for Reward Chest claims -- both are immediate/self-
// credited like 'action', but skip the generic "Новое доброе дело"
// notification (notify_on_action_insert only handles 'action'/'task'/
// 'goal'/'compliment', migration 0040).
export const applyAction = async (
  coupleId: string,
  title: string,
  points: number,
  recipientId?: string,
  type?: 'action' | 'compliment' | 'reward_chest',
): Promise<DbAction> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('apply_action', {
    p_couple_id: coupleId,
    p_title: title,
    p_points: points,
    p_recipient_id: recipientId,
    p_type: type,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbAction;
};
