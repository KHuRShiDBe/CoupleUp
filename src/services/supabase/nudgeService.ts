import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

// "Напомнить партнёру" -- a soft internal nudge, not a push notification.
// Rate-limited server-side (see send_partner_nudge in migration 0015): at
// most one nudge per (couple, entity) pair per 6 hours, enforced regardless
// of what the client does, so this can never be used to spam a partner.
export const sendPartnerNudge = async (input: {
  coupleId: string;
  entityType: string;
  entityId?: string | null;
  title: string;
}): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { error } = await supabase.rpc('send_partner_nudge', {
    p_couple_id: input.coupleId,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_title: input.title,
  });
  if (error) throw new ServiceError(error.message);
};
