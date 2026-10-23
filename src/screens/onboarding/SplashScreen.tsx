import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { RootStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { useTheme } from '../../theme/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

type SimpleTarget = 'Main' | 'Welcome' | 'ConnectPartner' | 'Tutorial';

const INTRO_VIDEO = require('../../../assets/videos/coupleup-intro.mp4');
// Ultimate safety net: if the video never fires playToEnd or an error event
// for some reason (a stuck decoder, an unusual device), the splash still
// leaves on its own instead of blocking the app forever.
const VIDEO_FALLBACK_MS = 6000;

export const SplashScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { isReady, onboardingComplete, tutorialComplete, languageSelected, userName, selectedRole, selectedAvatar, language } =
    useAppStore();
  const auth = useAuth();
  const sync = useCoupleSync();
  // Guards the self-heal call below to at most one attempt per mount --
  // without this, a still-failing ensureProfile() would retry on every
  // render this effect re-runs.
  const healAttempted = useRef(false);
  const navigatedRef = useRef(false);

  // What to navigate to is decided exactly as before (same auth/onboarding
  // logic, untouched) -- only WHEN it fires changed: now it waits for the
  // intro video to finish instead of a fixed timer.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [videoDone, setVideoDone] = useState(false);

  const player = useVideoPlayer(INTRO_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEventListener(player, 'playToEnd', () => setVideoDone(true));
  // A failed/unsupported video load must not hang the splash -- treat it
  // the same as "finished" so navigation still proceeds (spec item 7).
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error' || error) setVideoDone(true);
  });

  useEffect(() => {
    const timer = setTimeout(() => setVideoDone(true), VIDEO_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // Language choice always comes first, independent of auth state.
    if (!languageSelected) {
      setPendingAction(() => () => navigation.replace('Language', { mode: 'initial' }));
      return;
    }

    // No backend configured at all: fall back to the old local-only gate
    // rather than being unable to reach the app.
    if (!auth.configured) {
      const target: SimpleTarget = !onboardingComplete ? 'Welcome' : tutorialComplete ? 'Main' : 'Tutorial';
      setPendingAction(() => () => navigation.replace(target));
      return;
    }

    // A. Wait for Supabase session restore (bounded by
    // SESSION_RESTORE_TIMEOUT_MS in AuthContext -- this never hangs here
    // for the SDK's up-to-30s token-refresh retry).
    if (auth.loading) return;

    // B. No session -> onboarding starts at Welcome (Role/Avatar/Name/Auth).
    // But if `loading` only cleared because the restore TIMED OUT (not
    // because it actually finished), we don't yet know whether there's a
    // real session -- it may just be slow. Treating that as "logged out"
    // would wrongly bounce a returning user through onboarding, so fall
    // back to the same local-flags guess used when there's no backend at
    // all. The real session restore keeps running in the background and
    // updates `auth.session` reactively whenever it actually resolves --
    // nothing here signs anyone out or clears cached session data.
    if (!auth.session) {
      if (auth.sessionRestorePending) {
        const target: SimpleTarget = !onboardingComplete ? 'Welcome' : tutorialComplete ? 'Main' : 'Tutorial';
        setPendingAction(() => () => navigation.replace(target));
        return;
      }
      setPendingAction(() => () => navigation.replace('Welcome'));
      return;
    }

    // C. Session exists -> wait for the profile and couple to load before
    // deciding anything (never route off a stale/incomplete read).
    if (auth.profileLoading || sync.loading) return;

    // Self-heal: a session can exist with no profile row if an earlier
    // createProfile() attempt failed and nothing ever retried it (onboarding
    // only calls it once, in NameScreen) -- e.g. this session was created
    // before a backend permission fix. Recreate it here from the locally
    // cached onboarding fields instead of leaving the user stuck on
    // ConnectPartner with no profile and no way back into onboarding.
    if (!auth.profile) {
      if (!healAttempted.current && !auth.loading) {
        healAttempted.current = true;
        auth.ensureProfile({ name: userName, role: selectedRole ?? 'male', selectedAvatar: selectedAvatar ?? 1, language });
      }
      return;
    }

    // D/E. Profile loaded: couple decides Main vs ConnectPartner (and Main
    // itself is gated behind the one-time tutorial, same as local-mode above).
    const target: SimpleTarget = !sync.couple ? 'ConnectPartner' : tutorialComplete ? 'Main' : 'Tutorial';
    setPendingAction(() => () => navigation.replace(target));
  }, [
    isReady,
    languageSelected,
    onboardingComplete,
    tutorialComplete,
    auth.configured,
    auth.loading,
    auth.session,
    auth.sessionRestorePending,
    auth.profileLoading,
    auth.profile,
    sync.loading,
    sync.couple,
    navigation,
    userName,
    selectedRole,
    selectedAvatar,
    language,
  ]);

  // Only actually leaves once BOTH the destination is known AND the video
  // has finished (or errored, or hit the fallback timeout) -- whichever of
  // the two resolves last.
  useEffect(() => {
    if (!pendingAction || !videoDone || navigatedRef.current) return;
    navigatedRef.current = true;
    pendingAction();
  }, [pendingAction, videoDone]);

  return (
    // ScreenContainer's SafeAreaView only insets left/right (see its own
    // source) -- its top/bottom safe-area gap is plain padding on the inner
    // view, which an absolutely-positioned child ignores. That's what lets
    // the video go fully edge-to-edge instead of sitting in a small centered
    // box: it fills the whole screen behind/through that padding.
    <ScreenBackground>
    <ScreenContainer transparent padded={false} style={styles.container}>
      {videoDone ? (
        // Intro is over (or skipped via the fallback/error paths) -- show a
        // normal loading spinner instead of leaving the last video frame on
        // screen while the destination (auth/profile/couple) is still
        // resolving. Still the same route; only what's rendered changes.
        <ActivityIndicator size="large" color={colors.primary} style={styles.video} />
      ) : (
        <VideoView player={player} style={styles.video} nativeControls={false} contentFit="cover" />
      )}
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
