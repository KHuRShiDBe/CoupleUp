import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbActionRequest } from '../../types/database';

export const listActionRequests = async (coupleId: string): Promise<DbActionRequest[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('action_requests')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbActionRequest[]) ?? [];
};

// Creates a pending request -- no RPC needed (same as reward_requests/
// penalties), RLS already enforces actor_user_id = auth.uid() + couple
// membership. reviewer_user_id is deliberately NOT sent -- a BEFORE INSERT
// trigger fills it server-side from couple_members, so a client can never
// pick its own reviewer. Points are NOT applied here; only
// respond_action_request can do that, and only on approval.
export const createActionRequest = async (input: {
  coupleId: string;
  actorUserId: string;
  recipientId: string;
  title: string;
  points: number;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('action_requests').insert({
    couple_id: input.coupleId,
    actor_user_id: input.actorUserId,
    recipient_id: input.recipientId,
    title: input.title,
    points: input.points,
  });
  if (error) throw new ServiceError(error.message);
};

// Approves or rejects a pending request; only approving credits points
// (RPC: respond_action_request). The actor can never call this on their
// own request -- the RPC rejects that with CANNOT_SELF_CONFIRM.
export const respondActionRequest = async (actionRequestId: string, accept: boolean): Promise<DbActionRequest> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_action_request', {
    p_action_request_id: actionRequestId,
    p_accept: accept,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbActionRequest;
};
