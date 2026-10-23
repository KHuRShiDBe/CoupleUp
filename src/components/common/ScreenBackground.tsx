import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

// Full-page background fill -- fixed white for every screen, both roles.
// Used to pick a role-based pastel fill (blue for male, pink for female)
// from theme/colors.ts; that's removed here on purpose so the overall app
// background reads as plain white. Blue/pink stays everywhere else --
// cards (theme.card), icons (theme/iconColors.ts) and the accent color
// (theme.primary) are untouched by this. Wrap a screen's ENTIRE return
// value in this, and pass `transparent` to its <ScreenContainer> so
// nothing paints over it.
export const ScreenBackground = ({ children }: Props) => <View style={styles.fill}>{children}</View>;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
});
