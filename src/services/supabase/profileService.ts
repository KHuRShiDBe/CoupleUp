import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbNotificationPreferences, DbUser } from '../../types/database';
import { Role } from '../../types';
import { Language } from '../../localization';

// `profiles` (renamed from `users` in migration 0002) mirrors auth.users with
// the app-specific fields.
export const getProfile = async (userId: string): Promise<DbUser | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbUser) ?? null;
};

// Returns the written row so the caller can put it straight into state --
// callers must not rely on the separate session-driven getProfile() effect to
// pick this up, since that SELECT runs independently (triggered by the auth
// listener) and can resolve before this write has committed.
//
// Upsert (not insert): this also doubles as the recovery path for a session
// whose profile row never got created (e.g. an earlier attempt failed and
// nothing retried it) -- RLS still only lets it touch id = auth.uid(), via
// "profiles_insert_self"/"profiles_update_self", so this can't affect anyone
// else's row.
export const createProfile = async (
  userId: string,
  input: { name: string; language?: Language; role?: Role; selectedAvatar?: number },
): Promise<DbUser | null> => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        name: input.name,
        language: input.language,
        role: input.role,
        theme: input.role,
        selected_avatar: input.selectedAvatar,
      },
      { onConflict: 'id' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return (data as DbUser) ?? null;
};

export const updateProfile = async (
  userId: string,
  patch: {
    role?: Role;
    selectedAvatar?: number;
    photoUrl?: string | null;
    language?: Language;
    name?: string;
    notificationPreferences?: DbNotificationPreferences;
    pushEnabled?: boolean;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  },
): Promise<DbUser | null> => {
  if (!isSupabaseConfigured) return null;
  const dbPatch: Record<string, unknown> = {};
  if (patch.role) {
    dbPatch.role = patch.role;
    dbPatch.theme = patch.role;
  }
  if (patch.selectedAvatar) dbPatch.selected_avatar = patch.selectedAvatar;
  if (patch.photoUrl !== undefined) dbPatch.photo_url = patch.photoUrl;
  if (patch.language) dbPatch.language = patch.language;
  if (patch.name) dbPatch.name = patch.name;
  if (patch.notificationPreferences) dbPatch.notification_preferences = patch.notificationPreferences;
  if (patch.pushEnabled !== undefined) dbPatch.push_enabled = patch.pushEnabled;
  if (patch.quietHoursStart !== undefined) dbPatch.quiet_hours_start = patch.quietHoursStart;
  if (patch.quietHoursEnd !== undefined) dbPatch.quiet_hours_end = patch.quietHoursEnd;
  if (Object.keys(dbPatch).length === 0) return null;

  const { data, error } = await supabase.from('profiles').update(dbPatch).eq('id', userId).select().maybeSingle();
  if (error) throw new ServiceError(error.message);
  return (data as DbUser) ?? null;
};
