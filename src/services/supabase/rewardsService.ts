import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbReward, DbRewardRequest } from '../../types/database';

export const listRewards = async (coupleId: string): Promise<DbReward[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('rewards').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbReward[]) ?? [];
};

export const listRewardRequests = async (coupleId: string): Promise<DbRewardRequest[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('reward_requests')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbRewardRequest[]) ?? [];
};

export const requestReward = async (input: {
  coupleId: string;
  requestedBy: string;
  title: string;
  cost: number;
  message: string;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reward_requests').insert({
    couple_id: input.coupleId,
    requested_by: input.requestedBy,
    title: input.title,
    cost: input.cost,
    message: input.message,
  });
  if (error) throw new ServiceError(error.message);
};

// Accepts or rejects a pending request; only accepting deducts points (RPC: respond_reward_request).
export const respondRewardRequest = async (requestId: string, accept: boolean): Promise<DbRewardRequest> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_reward_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbRewardRequest;
};
