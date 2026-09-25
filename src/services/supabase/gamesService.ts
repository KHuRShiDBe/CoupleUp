import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbEitherOrChoice, DbGameRewardClaim, DbPartnerQuizAnswer, DbTruthOrDareProgress, TruthOrDareKind } from '../../types/database';

// ---- PartnerQuiz ---------------------------------------------------------

export const listPartnerQuizAnswers = async (coupleId: string): Promise<DbPartnerQuizAnswer[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('partner_quiz_answers').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbPartnerQuizAnswer[]) ?? [];
};

export const submitPartnerQuizAnswer = async (input: {
  coupleId: string;
  quizId: string;
  questionIndex: number;
  userId: string;
  selectedIndex: number;
}): Promise<DbPartnerQuizAnswer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('partner_quiz_answers')
    .upsert(
      {
        couple_id: input.coupleId,
        quiz_id: input.quizId,
        question_index: input.questionIndex,
        user_id: input.userId,
        selected_index: input.selectedIndex,
      },
      { onConflict: 'couple_id,quiz_id,question_index,user_id' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbPartnerQuizAnswer;
};

// ---- EitherOr -------------------------------------------------------------

export const listEitherOrChoices = async (coupleId: string): Promise<DbEitherOrChoice[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('either_or_choices').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbEitherOrChoice[]) ?? [];
};

export const submitEitherOrChoice = async (input: {
  coupleId: string;
  pairIndex: number;
  userId: string;
  choice: string;
}): Promise<DbEitherOrChoice> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('either_or_choices')
    .upsert(
      { couple_id: input.coupleId, pair_index: input.pairIndex, user_id: input.userId, choice: input.choice },
      { onConflict: 'couple_id,pair_index,user_id' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbEitherOrChoice;
};

// ---- TruthOrDare -----------------------------------------------------------

export const getTruthOrDareProgress = async (coupleId: string): Promise<DbTruthOrDareProgress | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('truth_or_dare_progress').select('*').eq('couple_id', coupleId).maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbTruthOrDareProgress) ?? null;
};

export const setTruthOrDareKind = async (coupleId: string, kind: TruthOrDareKind): Promise<DbTruthOrDareProgress> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('set_truth_or_dare_kind', { p_couple_id: coupleId, p_kind: kind });
  if (error) throw new ServiceError(error.message);
  return data as DbTruthOrDareProgress;
};

export const advanceTruthOrDare = async (input: {
  coupleId: string;
  totalRounds: number;
  rewardPoints: number;
  title: string;
}): Promise<DbTruthOrDareProgress> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('advance_truth_or_dare', {
    p_couple_id: input.coupleId,
    p_total_rounds: input.totalRounds,
    p_reward_points: input.rewardPoints,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbTruthOrDareProgress;
};

// ---- Shared reward guard ---------------------------------------------------

export const listGameRewardClaims = async (coupleId: string): Promise<DbGameRewardClaim[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('game_reward_claims').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbGameRewardClaim[]) ?? [];
};

// Returns false (no error) if this (couple, game_key) was already claimed --
// see claim_game_reward in migration 0018.
export const claimGameReward = async (input: {
  coupleId: string;
  gameKey: string;
  points: number;
  title: string;
}): Promise<boolean> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('claim_game_reward', {
    p_couple_id: input.coupleId,
    p_game_key: input.gameKey,
    p_points: input.points,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
  return data as boolean;
};
