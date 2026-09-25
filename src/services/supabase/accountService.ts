import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

// Both go straight through the user's own session -- no service_role needed.
// Changing email triggers Supabase's standard confirmation-link flow.
export const updateEmail = async (email: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new ServiceError(error.message);
};

export const updatePassword = async (password: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new ServiceError(error.message);
};

// Optional account recovery: upgrades the CURRENT session (anonymous or not)
// in place by attaching an email + password to it via Supabase Auth's own
// updateUser -- same auth.uid(), same profile, same couple, nothing about
// the account is re-created. This is deliberately NOT authService.signUp(),
// which creates a brand-new separate user and would orphan everything tied
// to the current anonymous id. No second auth backend involved.
export const setupRecovery = async (email: string, password: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { error } = await supabase.auth.updateUser({ email, password });
  if (error) throw new ServiceError(error.message);
};

// Account deletion needs the service_role key, which the app must never
// hold -- this invokes the `delete-account` Edge Function instead, which
// authenticates the caller from their own session token and does the
// privileged part server-side. See supabase/functions/delete-account/index.ts
// and supabase/README.md for the deploy steps.
export const requestAccountDeletion = async (): Promise<void> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw new ServiceError(error.message);
  if (data && data.ok !== true) throw new ServiceError('Не удалось удалить аккаунт');
};
