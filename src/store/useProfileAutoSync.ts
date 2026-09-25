import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useAppStore } from './AppContext';
import { Role, NotificationPreferences } from '../types';
import { Language } from '../localization';

const prefsEqual = (a: NotificationPreferences, b: NotificationPreferences): boolean =>
  a.actions === b.actions &&
  a.rewardRequests === b.rewardRequests &&
  a.penalties === b.penalties &&
  a.tasks === b.tasks &&
  a.goals === b.goals &&
  a.achievements === b.achievements;

// While signed in, keeps the Supabase profile's role/avatar/language/
// notification-preferences in sync with whatever the user picked locally
// (onboarding, avatar change, language switch, Settings notification
// toggles) -- so the server-side notification triggers respect the same
// per-category choices the user already sees in Settings. Local `userName`
// is intentionally not pushed here -- it defaults to a generic placeholder
// locally and would otherwise overwrite the real name set at sign-up.
export const useProfileAutoSync = (): void => {
  const { configured, session, profile, updateProfile } = useAuth();
  const { selectedRole, selectedAvatar, language, notificationPreferences } = useAppStore();

  useEffect(() => {
    if (!configured || !session?.user || !profile) return;

    const patch: {
      role?: Role;
      selectedAvatar?: number;
      language?: Language;
      notificationPreferences?: NotificationPreferences;
    } = {};
    if (selectedRole && selectedRole !== profile.role) patch.role = selectedRole;
    if (selectedAvatar && selectedAvatar !== profile.selected_avatar) patch.selectedAvatar = selectedAvatar;
    if (language && language !== profile.language) patch.language = language;
    if (!prefsEqual(notificationPreferences, profile.notification_preferences)) {
      patch.notificationPreferences = notificationPreferences;
    }

    if (Object.keys(patch).length === 0) return;
    updateProfile(patch);
    // profile is intentionally excluded: updateProfile() itself refreshes it,
    // and including it here would re-trigger this effect on every sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, session?.user?.id, selectedRole, selectedAvatar, language, notificationPreferences]);
};
