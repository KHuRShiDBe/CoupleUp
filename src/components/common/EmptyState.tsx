import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, spacing } from '../../theme/layout';
import { IconName } from '../../types';
import { IconImage } from './IconImage';

interface Props {
  icon: IconName;
  title: string;
  description?: string;
}

export const EmptyState = ({ icon, title, description }: Props) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
        <IconImage name={icon} size={30} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {!!description && <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
  description: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
