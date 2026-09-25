import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbCouple, DbCoupleMember, DbUser } from '../../types/database';

export const getMyCoupleId = async (userId: string): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new ServiceError(error.message);
  return data?.couple_id ?? null;
};

export const getCouple = async (coupleId: string): Promise<DbCouple | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('couples').select('*').eq('id', coupleId).maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbCouple) ?? null;
};

export const getCoupleMembers = async (coupleId: string): Promise<DbCoupleMember[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('couple_members').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbCoupleMember[]) ?? [];
};

export const getUserById = async (userId: string): Promise<DbUser | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbUser) ?? null;
};

// Creates a couple + a unique short code and adds the caller as its first member (RPC: create_couple).
export const createCouple = async (): Promise<DbCouple> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('create_couple');
  if (error) throw new ServiceError(error.message);
  return data as DbCouple;
};

// Joins an existing couple by its short code (RPC: join_couple_by_code).
export const joinCoupleByCode = async (code: string): Promise<DbCouple> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('join_couple_by_code', { join_code: code.trim().toUpperCase() });
  if (error) throw new ServiceError(error.message);
  return data as DbCouple;
};

// Leaves the caller's current couple: removes their couple_members row and
// auto-resolves anything left pending (RPC: leave_couple). The account,
// profile, and the couple's shared history/points for the remaining partner
// are all left untouched -- this is not account deletion.
export const leaveCouple = async (): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { error } = await supabase.rpc('leave_couple');
  if (error) throw new ServiceError(error.message);
};
