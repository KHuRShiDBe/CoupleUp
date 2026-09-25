import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/layout';

interface Props {
  lines?: number;
}

// Simple static skeleton (no animation dependency) used for the brief mock
// loading state on first mount of Home/History/Rewards/Profile/Requests.
export const LoadingState = ({ lines = 3 }: Props) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: lines }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.block,
            { backgroundColor: colors.border, opacity: 1 - index * 0.15 },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
  },
  block: {
    height: 64,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
});
