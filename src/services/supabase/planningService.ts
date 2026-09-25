import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import {
  DbDateIdeaSave,
  DbHabit,
  DbHabitLog,
  DbPlanItem,
  DbPromise,
  DbSurpriseIdea,
  DbWant,
  HabitFrequency,
  PlanBucket,
  PlanItemKind,
  PromiseStatus,
  SurprisePriority,
  WantKind,
} from '../../types/database';
import { TaskAssignee } from '../../types';

// ---- Habits + streak logs ---------------------------------------------------

export const listHabits = async (coupleId: string): Promise<DbHabit[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('habits').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbHabit[]) ?? [];
};

export const addHabit = async (input: {
  coupleId: string;
  createdBy: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  assignee: TaskAssignee;
}): Promise<DbHabit> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('habits')
    .insert({
      couple_id: input.coupleId,
      created_by: input.createdBy,
      title: input.title,
      description: input.description,
      frequency: input.frequency,
      assignee: input.assignee,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbHabit;
};

// Last 60 days is plenty for both "current streak" and "best streak" without
// pulling unbounded history.
export const listHabitLogs = async (coupleId: string): Promise<DbHabitLog[]> => {
  if (!isSupabaseConfigured) return [];
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('log_date', since.toISOString().slice(0, 10));
  if (error) throw new ServiceError(error.message);
  return (data as DbHabitLog[]) ?? [];
};

export const logHabit = async (habitId: string, coupleId: string, userId: string): Promise<DbHabitLog> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('habit_logs')
    .upsert({ habit_id: habitId, couple_id: coupleId, user_id: userId, log_date: today }, { onConflict: 'habit_id,user_id,log_date' })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbHabitLog;
};

// ---- Promises -----------------------------------------------------------

export const listPromises = async (coupleId: string): Promise<DbPromise[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('promises').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbPromise[]) ?? [];
};

export const addPromise = async (input: { coupleId: string; fromUserId: string; toUserId: string; title: string }): Promise<DbPromise> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('promises')
    .insert({ couple_id: input.coupleId, from_user_id: input.fromUserId, to_user_id: input.toUserId, title: input.title })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbPromise;
};

export const updatePromiseStatus = async (id: string, status: PromiseStatus): Promise<DbPromise> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('promises')
    .update({ status, resolved_at: status === 'active' ? null : new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbPromise;
};

// Completion specifically goes through the complete_promise RPC (migration
// 0016), not the raw update above: it atomically guards against completing
// an already-completed promise and awards its points server-side, so a
// double-tap/retry can never award the points twice. Cancelling has no
// reward attached, so it still uses the plain update.
export const completePromise = async (id: string, historyTitle?: string): Promise<DbPromise> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('complete_promise', {
    p_promise_id: id,
    p_history_title: historyTitle ?? null,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbPromise;
};

// ---- Saved date ideas ("Хотим попробовать") ------------------------------

export const listDateIdeaSaves = async (coupleId: string): Promise<DbDateIdeaSave[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('date_idea_saves').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbDateIdeaSave[]) ?? [];
};

export const saveDateIdea = async (input: {
  coupleId: string;
  createdBy: string;
  ideaKey?: string;
  title: string;
  category: string;
  priceUsd?: number;
}): Promise<DbDateIdeaSave> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('date_idea_saves')
    .insert({
      couple_id: input.coupleId,
      idea_key: input.ideaKey,
      title: input.title,
      category: input.category,
      price_usd: input.priceUsd,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbDateIdeaSave;
};

// ---- Wants / Don't wants -----------------------------------------------

export const listWants = async (coupleId: string): Promise<DbWant[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('wants').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbWant[]) ?? [];
};

export const addWant = async (input: { coupleId: string; userId: string; kind: WantKind; text: string }): Promise<DbWant> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('wants')
    .insert({ couple_id: input.coupleId, user_id: input.userId, kind: input.kind, text: input.text })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbWant;
};

// ---- Surprise ideas -- PRIVATE to the author (enforced server-side by RLS,
// see migration 0011; there is nothing client-side to filter here, the
// server simply never returns another user's rows).
// ---------------------------------------------------------------------------

export const listSurpriseIdeas = async (): Promise<DbSurpriseIdea[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('surprise_ideas').select('*').order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbSurpriseIdea[]) ?? [];
};

export const addSurpriseIdea = async (input: {
  coupleId: string;
  authorId: string;
  title: string;
  note?: string;
  priceUsd?: number;
  priority: SurprisePriority;
}): Promise<DbSurpriseIdea> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('surprise_ideas')
    .insert({
      couple_id: input.coupleId,
      author_id: input.authorId,
      title: input.title,
      note: input.note,
      price_usd: input.priceUsd,
      priority: input.priority,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbSurpriseIdea;
};

export const deleteSurpriseIdea = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('surprise_ideas').delete().eq('id', id);
  if (error) throw new ServiceError(error.message);
};

// ---- Plan board ------------------------------------------------------------

export const listPlanItems = async (coupleId: string): Promise<DbPlanItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('plan_items').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbPlanItem[]) ?? [];
};

export const addPlanItem = async (input: {
  coupleId: string;
  createdBy: string;
  kind: PlanItemKind;
  title: string;
  bucket: PlanBucket;
}): Promise<DbPlanItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('plan_items')
    .insert({ couple_id: input.coupleId, created_by: input.createdBy, kind: input.kind, title: input.title, bucket: input.bucket })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbPlanItem;
};

export const setPlanItemDone = async (id: string, done: boolean): Promise<DbPlanItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.from('plan_items').update({ done }).eq('id', id).select().single();
  if (error) throw new ServiceError(error.message);
  return data as DbPlanItem;
};
