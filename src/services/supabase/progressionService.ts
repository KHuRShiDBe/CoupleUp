import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbAchievementUnlock, DbChallengeProgress, DbDailyChallenge, DbQuizAnswer, DbRewardClaim } from '../../types/database';

// ---- Weekly challenges -------------------------------------------------

export const listChallengeProgress = async (coupleId: string, weekKey: string): Promise<DbChallengeProgress[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('challenge_progress').select('*').eq('couple_id', coupleId).eq('week_key', weekKey);
  if (error) throw new ServiceError(error.message);
  return (data as DbChallengeProgress[]) ?? [];
};

export const completeChallenge = async (coupleId: string, weekKey: string, challengeKey: string): Promise<DbChallengeProgress> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('challenge_progress')
    .upsert(
      { couple_id: coupleId, week_key: weekKey, challenge_key: challengeKey, completed: true, completed_at: new Date().toISOString() },
      { onConflict: 'couple_id,week_key,challenge_key' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbChallengeProgress;
};

// All-time count across every week -- used by the Reward Chest's "5 weekly
// challenges completed" milestone, which is cumulative, not per-week.
export const countCompletedChallenges = async (coupleId: string): Promise<number> => {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from('challenge_progress')
    .select('*', { count: 'exact', head: true })
    .eq('couple_id', coupleId)
    .eq('completed', true);
  if (error) throw new ServiceError(error.message);
  return count ?? 0;
};

export const markChallengeRewardClaimed = async (id: string): Promise<DbChallengeProgress> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.from('challenge_progress').update({ reward_claimed: true }).eq('id', id).select().single();
  if (error) throw new ServiceError(error.message);
  return data as DbChallengeProgress;
};

// Atomically marks a weekly challenge complete AND claims its reward in one
// server-side call (RPC: claim_challenge_reward, migration 0017) -- replaces
// the previous client pattern of completeChallenge() followed by a separate
// markChallengeRewardClaimed() call, which read its own just-issued insert
// from a stale local array and could skip the "already claimed" guard,
// double-paying the bonus. Use this instead of completeChallenge +
// markChallengeRewardClaimed + a separate points-ledger insert.
export const claimChallengeReward = async (input: {
  coupleId: string;
  weekKey: string;
  challengeKey: string;
  rewardPoints: number;
  title: string;
}): Promise<DbChallengeProgress> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('claim_challenge_reward', {
    p_couple_id: input.coupleId,
    p_week_key: input.weekKey,
    p_challenge_key: input.challengeKey,
    p_reward_points: input.rewardPoints,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbChallengeProgress;
};

// Atomically marks the couple's shared daily challenge complete AND claims
// its reward in one server-side call (RPC: complete_daily_challenge,
// migration 0017). Replaces the previous unguarded pattern of upserting
// daily_challenges then unconditionally calling apply_action -- a rapid
// double-tap could fire the points grant twice before either resolved.
export const completeDailyChallengeAtomic = async (input: {
  coupleId: string;
  rewardPoints: number;
  title: string;
}): Promise<DbDailyChallenge> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('complete_daily_challenge', {
    p_couple_id: input.coupleId,
    p_reward_points: input.rewardPoints,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbDailyChallenge;
};

// ---- Daily challenge -------------------------------------------------

export const getTodayDailyChallenge = async (coupleId: string): Promise<DbDailyChallenge | null> => {
  if (!isSupabaseConfigured) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('challenge_date', today)
    .maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbDailyChallenge) ?? null;
};

export const completeDailyChallenge = async (coupleId: string, userId: string): Promise<DbDailyChallenge> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_challenges')
    .upsert({ couple_id: coupleId, challenge_date: today, completed_by: userId }, { onConflict: 'couple_id,challenge_date' })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbDailyChallenge;
};

// ---- Achievements ----------------------------------------------------

export const listAchievementUnlocks = async (coupleId: string): Promise<DbAchievementUnlock[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('achievement_unlocks').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbAchievementUnlock[]) ?? [];
};

// Idempotent: unique(couple_id, achievement_key) means a second insert for
// an already-unlocked achievement just needs to be ignored, not treated as
// an error.
export const unlockAchievement = async (coupleId: string, achievementKey: string): Promise<DbAchievementUnlock | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('achievement_unlocks')
    .insert({ couple_id: coupleId, achievement_key: achievementKey })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return null; // already unlocked
    throw new ServiceError(error.message);
  }
  return data as DbAchievementUnlock;
};

// ---- Reward chest ------------------------------------------------------

export const listRewardClaims = async (coupleId: string): Promise<DbRewardClaim[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('reward_claims').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbRewardClaim[]) ?? [];
};

export const claimReward = async (input: {
  coupleId: string;
  milestoneKey: string;
  pointsAwarded: number;
  claimedBy: string;
}): Promise<DbRewardClaim | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('reward_claims')
    .insert({ couple_id: input.coupleId, milestone_key: input.milestoneKey, points_awarded: input.pointsAwarded, claimed_by: input.claimedBy })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return null; // already claimed
    throw new ServiceError(error.message);
  }
  return data as DbRewardClaim;
};

// ---- Couple quiz -----------------------------------------------------

export const listQuizAnswers = async (coupleId: string): Promise<DbQuizAnswer[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('quiz_answers').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbQuizAnswer[]) ?? [];
};

export const submitQuizAnswer = async (coupleId: string, userId: string, questionKey: string, answer: string): Promise<DbQuizAnswer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('quiz_answers')
    .upsert({ couple_id: coupleId, user_id: userId, question_key: questionKey, answer }, { onConflict: 'couple_id,user_id,question_key' })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbQuizAnswer;
};
