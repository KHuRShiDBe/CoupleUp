import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { IconName } from '../../types';
import { IconImage } from '../common/IconImage';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
  colorOverride?: { primary: string; textOnPrimary: string };
  // Optional leading icon -- every existing call site omits this and renders
  // exactly as before (label only).
  icon?: IconName;
}

export const PrimaryButton = ({ label, onPress, disabled, loading, variant = 'primary', style, colorOverride, icon }: Props) => {
  const { colors: themeColors } = useTheme();
  const colors = colorOverride ? { ...themeColors, ...colorOverride } : themeColors;
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isOutline ? 'transparent' : colors.primary,
          borderColor: colors.primary,
          borderWidth: isOutline ? 1.5 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : colors.textOnPrimary} />
      ) : icon ? (
        <View style={styles.iconRow}>
          <IconImage name={icon} size={30} style={styles.icon} />
          <Text style={[styles.label, { color: isOutline ? colors.primary : colors.textOnPrimary }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: isOutline ? colors.primary : colors.textOnPrimary }]} numberOfLines={2}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    // minHeight (not height): every button keeps the same 56px baseline, but
    // a label too long for one line grows the button instead of clipping --
    // screens that need a shorter fixed row (e.g. side-by-side accept/decline)
    // still override this with their own `height` via the `style` prop.
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.3,
    fontWeight: '600',
    textAlign: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
});
