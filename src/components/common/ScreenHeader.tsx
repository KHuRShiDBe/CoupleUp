import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, spacing } from '../../theme/layout';
import { IconImage } from './IconImage';

interface Props {
  title: string;
  onBack?: () => void;
}

export const ScreenHeader = ({ title, onBack }: Props) => {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <IconImage name="back" size={28} />
        </Pressable>
      ) : (
        <View style={styles.backButtonSpacer} />
      )}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={styles.backButtonSpacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonSpacer: {
    width: 52,
    height: 52,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
