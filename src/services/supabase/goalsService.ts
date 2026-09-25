import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbGoal } from '../../types/database';

export const listGoals = async (coupleId: string): Promise<DbGoal[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('goals').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbGoal[]) ?? [];
};

// No "create goal" UI ever existed even in the legacy local version -- this
// only completes the wiring for the table/RLS that already supported it
// (goals_insert_member), so SharedGoalsScreen isn't permanently stuck empty
// now that it reads the real (initially empty) `goals` table.
export const createGoal = async (input: { coupleId: string; title: string; targetPoints: number; icon?: string }): Promise<DbGoal> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('goals')
    .insert({ couple_id: input.coupleId, title: input.title, target_points: input.targetPoints, icon: input.icon ?? 'goal' })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbGoal;
};

// Moves points from the couple's balance into a shared goal (RPC: add_to_goal).
export const addToGoal = async (goalId: string, amount: number): Promise<DbGoal> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('add_to_goal', { p_goal_id: goalId, p_amount: amount });
  if (error) throw new ServiceError(error.message);
  return data as DbGoal;
};
