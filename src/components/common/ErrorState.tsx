import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { IconImage } from './IconImage';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

// Full-weight error block for whole-screen failures (network error, backend not
// configured, invalid couple code, failed request) -- as opposed to the compact
// inline BackendStatusBanner used under a form field.
export const ErrorState = ({ title = 'Что-то пошло не так', message, onRetry }: Props) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.danger }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
        <IconImage name="notification" size={26} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry && <PrimaryButton label="Повторить" onPress={onRetry} variant="outline" style={styles.retry} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  retry: {
    width: '100%',
  },
});
