import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';

interface Props {
  label: string;
  value: number;
  emphasis?: boolean;
}

export const StatCard = ({ label, value, emphasis }: Props) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadow.soft,
        {
          backgroundColor: emphasis ? colors.primary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.value, { color: emphasis ? colors.textOnPrimary : colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: emphasis ? colors.textOnPrimary : colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    fontSize: fontSize.xs,
  },
});
