import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../theme/useTheme';
import { backgroundImages } from '../../constants/backgrounds';

interface Props {
  children: React.ReactNode;
}

// Full-page background image, picked by the signed-in user's own profile
// role (Supabase-backed, same source as WishRouletteScreen -- falls back to
// the local theme role only for the instant before the profile has loaded).
// Wrap a screen's ENTIRE return value in this, and pass `transparent` to its
// <ScreenContainer> so nothing paints over the image underneath.
export const ScreenBackground = ({ children }: Props) => {
  const auth = useAuth();
  const { role: themeRole } = useTheme();
  const role = auth.profile?.role ?? themeRole;

  return (
    <ImageBackground source={backgroundImages[role]} style={styles.fill} resizeMode="cover">
      {/* Male: no wash at all. bg-male12.png is already a deep navy/blue
          image (not the old washed-out/purple bg-male1.png) -- readability
          comes from the existing opaque white/blue cards already sitting on
          top of it, not from dimming or lightening the photo itself. Adding
          another overlay here is exactly the "whitening" bug being fixed --
          not layering a different-colored one on top. */}
      {role === 'female' && <View style={styles.overlay} pointerEvents="none" />}
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
