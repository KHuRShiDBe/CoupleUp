import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { IconName } from '../../types';
import { IconImage } from './IconImage';

// Shared by SettingsScreen and its sub-hubs (PrivacyDataScreen, AboutScreen)
// so all three settings-style lists look and behave identically.
export const SettingsSectionTitle = ({ label }: { label: string }) => {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{label}</Text>;
};

interface SettingsRowProps {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress?: () => void;
}

export const SettingsRow = ({ icon, label, subtitle, onPress }: SettingsRowProps) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
        <IconImage name={icon} size={20} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {!!subtitle && <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
