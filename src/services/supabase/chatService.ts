import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbChatMessage } from '../../types/database';

const HISTORY_LIMIT = 200;

export const listMessages = async (coupleId: string): Promise<DbChatMessage[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);
  if (error) throw new ServiceError(error.message);
  return (data as DbChatMessage[]) ?? [];
};

export const sendMessage = async (coupleId: string, senderId: string, text: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const trimmed = text.trim();
  if (!trimmed) throw new ServiceError('Сообщение не может быть пустым', 'CHAT_MESSAGE_EMPTY');
  const { error } = await supabase
    .from('chat_messages')
    .insert({ couple_id: coupleId, sender_id: senderId, text: trimmed });
  if (error) throw new ServiceError(error.message);
};

// Marks every one of the PARTNER's messages (never my own -- RLS also
// enforces this server-side) as read. Called when the chat screen opens and
// whenever a new message arrives while it's open.
export const markPartnerMessagesRead = async (coupleId: string, myUserId: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('couple_id', coupleId)
    .is('read_at', null)
    .neq('sender_id', myUserId);
  if (error) throw new ServiceError(error.message);
};
