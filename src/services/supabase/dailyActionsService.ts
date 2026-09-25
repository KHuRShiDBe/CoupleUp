import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbDailyActionCompletion, DbDailyProgress } from '../../types/database';

// Last 60 days is enough for the current month's calendar plus a little
// slack, without pulling unbounded history.
export const listDailyActionCompletions = async (coupleId: string): Promise<DbDailyActionCompletion[]> => {
  if (!isSupabaseConfigured) return [];
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from('daily_action_completions')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('action_date', since.toISOString().slice(0, 10));
  if (error) throw new ServiceError(error.message);
  return (data as DbDailyActionCompletion[]) ?? [];
};

export const listDailyProgress = async (coupleId: string): Promise<DbDailyProgress[]> => {
  if (!isSupabaseConfigured) return [];
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from('daily_progress')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('progress_date', since.toISOString().slice(0, 10));
  if (error) throw new ServiceError(error.message);
  return (data as DbDailyProgress[]) ?? [];
};

// Returns false (no error) if this action was already completed today --
// see complete_daily_action in migration 0019.
export const completeDailyAction = async (input: {
  coupleId: string;
  actionId: string;
  actionDate: string;
  points: number;
  title: string;
}): Promise<boolean> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('complete_daily_action', {
    p_couple_id: input.coupleId,
    p_action_id: input.actionId,
    p_action_date: input.actionDate,
    p_points: input.points,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as boolean;
};

export const claimDailyBonus = async (input: {
  coupleId: string;
  actionDate: string;
  requiredCount: number;
  bonusPoints: number;
  title: string;
}): Promise<boolean> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('claim_daily_bonus', {
    p_couple_id: input.coupleId,
    p_action_date: input.actionDate,
    p_required_count: input.requiredCount,
    p_bonus_points: input.bonusPoints,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as boolean;
};

// Returns the server-picked reward (one of WHEEL_VALUES) -- never trust a
// client-computed spin result.
export const spinDailyRewardWheel = async (input: { coupleId: string; actionDate: string; title: string }): Promise<number> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('spin_daily_reward_wheel', {
    p_couple_id: input.coupleId,
    p_action_date: input.actionDate,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as number;
};
