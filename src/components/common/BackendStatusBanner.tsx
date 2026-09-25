import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';

interface Props {
  message: string;
  onRetry?: () => void;
}

export const BackendStatusBanner = ({ message, onRetry }: Props) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.banner, { backgroundColor: colors.background, borderColor: colors.danger }]}>
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={[styles.retryButton, { borderColor: colors.danger }]}>
          <Text style={[styles.retryText, { color: colors.danger }]}>Повторить</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  text: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
