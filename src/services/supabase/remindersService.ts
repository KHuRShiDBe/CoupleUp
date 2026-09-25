import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbReminder, DbReminderDelivery, ReminderRule, ReminderTargetType } from '../../types/database';

export const listReminders = async (): Promise<DbReminder[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: true });
  if (error) throw new ServiceError(error.message);
  return (data as DbReminder[]) ?? [];
};

export const addReminder = async (input: {
  coupleId: string;
  userId: string;
  targetType: ReminderTargetType;
  targetId?: string;
  title: string;
  rule: ReminderRule;
  remindAt: string;
  repeatWeekly: boolean;
}): Promise<DbReminder> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      couple_id: input.coupleId,
      user_id: input.userId,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      title: input.title,
      rule: input.rule,
      remind_at: input.remindAt,
      repeat_weekly: input.repeatWeekly,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbReminder;
};

export const setReminderActive = async (id: string, isActive: boolean): Promise<DbReminder> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.from('reminders').update({ is_active: isActive }).eq('id', id).select().single();
  if (error) throw new ServiceError(error.message);
  return data as DbReminder;
};

// Called by the local scheduler once a reminder actually fires, so
// weekly-repeating reminders can be rescheduled from their own last fire time
// instead of drifting relative to when the app happened to be opened.
export const markReminderFired = async (id: string, remindAt: string): Promise<DbReminder> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('reminders')
    .update({ last_fired_at: new Date().toISOString(), remind_at: remindAt })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbReminder;
};

export const deleteReminder = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw new ServiceError(error.message);
};

export const recordReminderDelivery = async (reminderId: string, scheduledFor: string): Promise<DbReminderDelivery> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('reminder_deliveries')
    .insert({ reminder_id: reminderId, scheduled_for: scheduledFor, status: 'delivered', delivered_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbReminderDelivery;
};
