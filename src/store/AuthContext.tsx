import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../lib/supabase';
import * as authService from '../services/supabase/authService';
import * as profileService from '../services/supabase/profileService';
import * as deviceTokenService from '../services/supabase/deviceTokenService';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { getDeviceId } from '../utils/deviceId';
import { useAppStore } from './AppContext';
import { DbNotificationPreferences, DbUser } from '../types/database';
import { Role } from '../types';
import { Language } from '../localization';

interface ProfileUpdateInput {
  role?: Role;
  selectedAvatar?: number;
  photoUrl?: string | null;
  language?: Language;
  name?: string;
  notificationPreferences?: DbNotificationPreferences;
  pushEnabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}

interface AuthContextValue {
  configured: boolean;
  session: Session | null;
  profile: DbUser | null;
  loading: boolean;
  // True while the profile row for the current session is being fetched --
  // distinct from `loading`, which only covers session restore/signIn/signUp.
  // Splash needs this to avoid deciding "no profile" before the fetch resolves.
  profileLoading: boolean;
  error: string | null;
  clearError: () => void;
  // Default onboarding path: no email/password, just a real Supabase user id.
  signInAnonymously: (input: { name: string; role: Role; selectedAvatar: number; language?: Language }) => Promise<void>;
  // Recovery path for a session that already exists but has no profile row
  // (e.g. an earlier createProfile() attempt failed and nothing retried it).
  // Writes to the CURRENT session's id -- unlike signInAnonymously, it never
  // creates a new auth user.
  ensureProfile: (input: { name: string; role: Role; selectedAvatar: number; language?: Language }) => Promise<void>;
  // Kept for a future "upgrade this account" flow (e.g. from AccountScreen) --
  // not used by onboarding anymore.
  signUp: (email: string, password: string, name: string, language?: Language) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Only used to clear the legacy per-device AsyncStorage mock state on
  // sign-out (see signOut below) -- without this, a second person signing in
  // anonymously on the same device would inherit the first person's local
  // tasks/rewards/goals/wishlist/etc, since that store is device-scoped, not
  // session-scoped.
  const app = useAppStore();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    authService.getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    return authService.onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    profileService
      .getProfile(session.user.id)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyMessage(toServiceError(e)));
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      session,
      profile,
      loading,
      profileLoading,
      error,
      clearError: () => setError(null),
      signInAnonymously: async (input: { name: string; role: Role; selectedAvatar: number; language?: Language }) => {
        setLoading(true);
        setError(null);
        try {
          const newSession = await authService.signInAnonymously();
          if (newSession?.user) {
            // Set the profile directly from the INSERT's own result instead
            // of waiting on the separate session-driven getProfile() effect --
            // that SELECT is triggered independently by the auth listener and
            // can otherwise resolve (to "not found yet") before this INSERT
            // has committed, letting the caller move on with no real profile
            // row yet (e.g. createCouple() failing its FK on profiles.id).
            const created = await profileService.createProfile(newSession.user.id, {
              name: input.name,
              role: input.role,
              selectedAvatar: input.selectedAvatar,
              language: input.language,
            });
            if (created) setProfile(created);
          }
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        } finally {
          setLoading(false);
        }
      },
      ensureProfile: async (input: { name: string; role: Role; selectedAvatar: number; language?: Language }) => {
        if (!session?.user) return;
        setLoading(true);
        setError(null);
        try {
          const created = await profileService.createProfile(session.user.id, input);
          if (created) setProfile(created);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        } finally {
          setLoading(false);
        }
      },
      signUp: async (email: string, password: string, name: string, language?: Language) => {
        setLoading(true);
        setError(null);
        try {
          const data = await authService.signUpWithEmail(email, password);
          if (data.user) await profileService.createProfile(data.user.id, { name, language });
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        } finally {
          setLoading(false);
        }
      },
      signIn: async (email: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
          await authService.signInWithEmail(email, password);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        // Deactivate this device's push token before the session goes away --
        // once signed out, RLS would refuse the delete (it's scoped to the
        // caller's own rows), so this has to happen first.
        if (session?.user) {
          try {
            const deviceId = await getDeviceId();
            await deviceTokenService.deleteDeviceToken(session.user.id, deviceId);
          } catch {
            // Non-fatal: sign-out proceeds either way.
          }
        }
        await authService.signOut();
        // Clear the legacy per-device mock store so a different person
        // signing in anonymously on this same device never sees the
        // previous person's local-only data (see the comment on `app` above).
        app.actions.resetApp();
      },
      updateProfile: async (input: ProfileUpdateInput) => {
        if (!session?.user) return;
        try {
          const updated = await profileService.updateProfile(session.user.id, input);
          setProfile(updated);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
    }),
    [session, profile, loading, profileLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
