import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

const ensureConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  }
};

export const getSession = async (): Promise<Session | null> => {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};

// Returns an unsubscribe function; a no-op when the backend isn't configured yet.
export const onAuthStateChange = (callback: (session: Session | null) => void): (() => void) => {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
};

// Anonymous auth: creates a real auth.users row (with a real auth.uid()) but
// no email/password. Used as the default onboarding path -- can be upgraded
// to a real email/password account later via authService.signUpWithEmail's
// linking counterpart without losing the user's data.
export const signInAnonymously = async (): Promise<Session | null> => {
  ensureConfigured();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new ServiceError(error.message);
  return data.session;
};

export const signUpWithEmail = async (email: string, password: string) => {
  ensureConfigured();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new ServiceError(error.message);
  return data;
};

export const signInWithEmail = async (email: string, password: string): Promise<void> => {
  ensureConfigured();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new ServiceError(error.message);
};

export const signOut = async (): Promise<void> => {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
};
