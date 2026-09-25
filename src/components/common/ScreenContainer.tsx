import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { spacing, safeVertical } from '../../theme/layout';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  // Screens hosted inside the bottom tab navigator sit above a tab bar that
  // already reserves the bottom safe-area inset -- adding it again here just
  // leaves a large empty gap above the tab bar. Only these screens pass this.
  inTabBar?: boolean;
  // For screens wrapped in <ScreenBackground> (a full-screen background
  // image) -- skips the normal opaque colors.background fill so the image
  // behind shows through. Every other screen is unaffected by this prop.
  transparent?: boolean;
}

export const ScreenContainer = ({ children, style, padded = true, inTabBar = false, transparent = false }: Props) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: transparent ? 'transparent' : colors.background }]}
      edges={['left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.content,
          padded && styles.padded,
          {
            paddingTop: insets.top + safeVertical,
            paddingBottom: inTabBar ? 0 : insets.bottom + safeVertical,
          },
          style,
        ]}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
