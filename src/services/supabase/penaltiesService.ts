import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbPenalty } from '../../types/database';

export const listPenalties = async (coupleId: string): Promise<DbPenalty[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('penalties')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbPenalty[]) ?? [];
};

export const createPenalty = async (input: {
  coupleId: string;
  createdBy: string;
  targetUserId: string;
  title: string;
  points: number;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('penalties').insert({
    couple_id: input.coupleId,
    created_by: input.createdBy,
    target_user_id: input.targetUserId,
    title: input.title,
    points: input.points,
  });
  if (error) throw new ServiceError(error.message);
};

// Confirms or rejects a pending penalty; only confirming deducts points (RPC: respond_penalty).
export const respondPenalty = async (penaltyId: string, accept: boolean): Promise<DbPenalty> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_penalty', { p_penalty_id: penaltyId, p_accept: accept });
  if (error) throw new ServiceError(error.message);
  return data as DbPenalty;
};
