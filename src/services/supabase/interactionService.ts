import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbCoupleMoment, DbDailyAnswer, DbImportantDate, DbMoodCheckin, ImportantDateType, MoodValue } from '../../types/database';

// ---- Mood check-ins ---------------------------------------------------------

export const listMoodCheckins = async (coupleId: string, sinceDate: string): Promise<DbMoodCheckin[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('mood_checkins')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('checkin_date', sinceDate)
    .order('checkin_date', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbMoodCheckin[]) ?? [];
};

// One row per user per day (unique constraint) -- submitting again the same
// day replaces that day's mood instead of erroring.
export const submitMoodCheckin = async (coupleId: string, userId: string, mood: MoodValue): Promise<DbMoodCheckin> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('mood_checkins')
    .upsert(
      { couple_id: coupleId, user_id: userId, mood, checkin_date: today },
      { onConflict: 'user_id,checkin_date' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbMoodCheckin;
};

// ---- Daily answers (Question of the Day) ------------------------------------

export const listDailyAnswers = async (coupleId: string, sinceDate: string): Promise<DbDailyAnswer[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('daily_answers')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('question_date', sinceDate)
    .order('question_date', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbDailyAnswer[]) ?? [];
};

export const submitDailyAnswer = async (coupleId: string, userId: string, answer: string): Promise<DbDailyAnswer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_answers')
    .upsert(
      { couple_id: coupleId, user_id: userId, answer, question_date: today },
      { onConflict: 'user_id,question_date' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbDailyAnswer;
};

// ---- Couple moments ----------------------------------------------------------

export const listMoments = async (coupleId: string): Promise<DbCoupleMoment[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('couple_moments')
    .select('*')
    .eq('couple_id', coupleId)
    .order('moment_date', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbCoupleMoment[]) ?? [];
};

export const addMoment = async (input: {
  coupleId: string;
  authorId: string;
  title: string;
  description?: string;
  momentDate: string;
}): Promise<DbCoupleMoment> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('couple_moments')
    .insert({
      couple_id: input.coupleId,
      author_id: input.authorId,
      title: input.title,
      description: input.description,
      moment_date: input.momentDate,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleMoment;
};

// ---- Important dates -----------------------------------------------------

export const listImportantDates = async (coupleId: string): Promise<DbImportantDate[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('important_dates')
    .select('*')
    .eq('couple_id', coupleId)
    .order('date', { ascending: true });
  if (error) throw new ServiceError(error.message);
  return (data as DbImportantDate[]) ?? [];
};

export const addImportantDate = async (input: {
  coupleId: string;
  createdBy: string;
  type: ImportantDateType;
  label: string;
  date: string;
}): Promise<DbImportantDate> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('important_dates')
    .insert({
      couple_id: input.coupleId,
      created_by: input.createdBy,
      type: input.type,
      label: input.label,
      date: input.date,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbImportantDate;
};
