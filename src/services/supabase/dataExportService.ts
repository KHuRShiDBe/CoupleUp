import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

// Every couple-scoped table the app has ever added, in one place, so a new
// package's table gets picked up here too. Fetched with the caller's own
// session (RLS-scoped, same as every other query in the app) -- there is no
// way for this to return another couple's rows.
const COUPLE_TABLES = [
  'actions',
  'tasks',
  'goals',
  'reward_requests',
  'penalties',
  'mood_checkins',
  'daily_answers',
  'couple_moments',
  'important_dates',
  'habits',
  'habit_logs',
  'promises',
  'date_idea_saves',
  'wants',
  'surprise_ideas', // RLS narrows this to the caller's own rows only
  'plan_items',
  'shopping_items',
  'budgets',
  'expenses',
  'savings_goals',
  'savings_contributions',
  'purchase_requests',
  'challenge_progress',
  'daily_challenges',
  'achievement_unlocks',
  'reward_claims',
  'quiz_answers',
] as const;

// Deliberately NOT exported: device_tokens (push token, credential-like),
// notifications (operational, not user-authored content), and anything
// under auth.* (session/auth tokens never leave Supabase Auth's own store).
export const exportMyData = async (userId: string, coupleId: string | null): Promise<Record<string, unknown>> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');

  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (profileError) throw new ServiceError(profileError.message);

  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    couple: null,
  };

  if (!coupleId) return result;

  const { data: couple, error: coupleError } = await supabase.from('couples').select('*').eq('id', coupleId).maybeSingle();
  if (coupleError) throw new ServiceError(coupleError.message);
  result.couple = couple ?? null;

  const tableResults = await Promise.all(
    COUPLE_TABLES.map((table) => supabase.from(table).select('*').eq('couple_id', coupleId)),
  );

  tableResults.forEach(({ data: rows, error }, i) => {
    if (error) throw new ServiceError(error.message);
    result[COUPLE_TABLES[i]] = rows ?? [];
  });

  return result;
};
