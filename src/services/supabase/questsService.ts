import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbQuestBonusClaim, DbQuestCustomItem, DbQuestHiddenItem, DbQuestProgress, QuestPeriod } from '../../types/database';

// 400 days covers a full yearly cycle plus slack, without pulling unbounded history.
const LOOKBACK_DAYS = 400;
const sinceIso = () => {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  return since.toISOString();
};

export const listQuestProgress = async (coupleId: string): Promise<DbQuestProgress[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('quest_progress')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('created_at', sinceIso());
  if (error) throw new ServiceError(error.message);
  return (data as DbQuestProgress[]) ?? [];
};

export const listQuestBonusClaims = async (coupleId: string): Promise<DbQuestBonusClaim[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('quest_bonus_claims')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('claimed_at', sinceIso());
  if (error) throw new ServiceError(error.message);
  return (data as DbQuestBonusClaim[]) ?? [];
};

// Returns false (no error) if this item was already completed for this
// period/period_key -- see complete_quest_item (migration 0021, points-award
// half routed through a pending action_requests row as of migration 0038 --
// the balance only moves once the partner approves it).
export const completeQuestItem = async (input: {
  coupleId: string;
  period: QuestPeriod;
  periodKey: string;
  itemKey: string;
  title: string;
  points: number;
}): Promise<boolean> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('complete_quest_item', {
    p_couple_id: input.coupleId,
    p_period: input.period,
    p_period_key: input.periodKey,
    p_item_key: input.itemKey,
    p_title: input.title,
    p_points: input.points,
  });
  if (error) throw new ServiceError(error.message);
  return data as boolean;
};

export const listQuestCustomItems = async (coupleId: string): Promise<DbQuestCustomItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('quest_custom_items')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('created_at', sinceIso());
  if (error) throw new ServiceError(error.message);
  return (data as DbQuestCustomItem[]) ?? [];
};

export const addQuestCustomItem = async (input: {
  coupleId: string;
  period: QuestPeriod;
  periodKey: string;
  itemKey: string;
  title: string;
  points: number;
  createdBy: string;
  replacesItemKey?: string;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('quest_custom_items').insert({
    couple_id: input.coupleId,
    period: input.period,
    period_key: input.periodKey,
    item_key: input.itemKey,
    title: input.title,
    points: input.points,
    created_by: input.createdBy,
    replaces_item_key: input.replacesItemKey ?? null,
  });
  if (error) throw new ServiceError(error.message);
};

// Hidden items are period-scoped, not period_key-scoped -- hiding a
// standard item is a standing preference, not a one-day thing.
export const listQuestHiddenItems = async (coupleId: string): Promise<DbQuestHiddenItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('quest_hidden_items').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbQuestHiddenItem[]) ?? [];
};

export const hideQuestItem = async (input: {
  coupleId: string;
  userId: string;
  period: QuestPeriod;
  itemKey: string;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('quest_hidden_items').insert({
    couple_id: input.coupleId,
    user_id: input.userId,
    period: input.period,
    item_key: input.itemKey,
  });
  if (error) throw new ServiceError(error.message);
};

export const claimQuestBonus = async (input: {
  coupleId: string;
  period: QuestPeriod;
  periodKey: string;
  milestone: number;
  bonusPoints: number;
  title: string;
}): Promise<boolean> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('claim_quest_bonus', {
    p_couple_id: input.coupleId,
    p_period: input.period,
    p_period_key: input.periodKey,
    p_milestone: input.milestone,
    p_bonus_points: input.bonusPoints,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as boolean;
};
