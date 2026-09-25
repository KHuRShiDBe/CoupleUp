import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
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
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <IconImage name="back" size={30} />
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
    borderRadius: radius.round,
    borderWidth: 1,
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
