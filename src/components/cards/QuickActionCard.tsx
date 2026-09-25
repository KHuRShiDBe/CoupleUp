import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { IconName } from '../../types';
import { IconImage } from '../common/IconImage';

interface Props {
  label: string;
  icon: IconName;
  onPress: () => void;
  // Optional visual overrides, layered on top of the default theme-based
  // look -- every existing call site (AllSectionsScreen, etc.) omits these
  // and renders exactly as before. Only HomeScreen's own "Каждый день" card
  // passes these, and only for the male account's dark Home treatment.
  cardStyle?: StyleProp<ViewStyle>;
  iconWrapStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const QuickActionCard = ({ label, icon, onPress, cardStyle, iconWrapStyle, labelStyle }: Props) => {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadow.soft,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        cardStyle,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.background }, iconWrapStyle]}>
        <IconImage name={icon} size={50} />
      </View>
      <Text style={[styles.label, { color: colors.text }, labelStyle]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '47%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.3,
    fontWeight: '600',
  },
});
