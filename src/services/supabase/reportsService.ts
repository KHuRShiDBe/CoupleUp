import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

export type ReportReason = 'abuse' | 'spam' | 'unwanted_contact' | 'other';

// Write-only: the client can never read reports back (no select policy on
// `reports`), so a submitted report is never shown to anyone in the app --
// it's a moderation queue reviewed only via the Supabase dashboard.
export const submitReport = async (input: {
  reportedUserId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ServiceError('Не авторизован');
  const { error } = await supabase.from('reports').insert({
    reporter_id: auth.user.id,
    reported_user_id: input.reportedUserId,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) throw new ServiceError(error.message);
};
