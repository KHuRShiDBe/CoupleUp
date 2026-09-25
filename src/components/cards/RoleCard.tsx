import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getTheme } from '../../theme/colors';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { Role } from '../../types';
import { roleImages } from '../../constants/assets';

interface Props {
  role: Role;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

export const RoleCard = ({ role, title, subtitle, selected, onPress }: Props) => {
  const colors = getTheme(role);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        shadow.soft,
        {
          backgroundColor: selected ? colors.background : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
        },
        selected && {
          shadowColor: colors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
        <Image source={roleImages[role]} style={styles.roleImage} resizeMode="cover" />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  roleImage: {
    width: 88,
    height: 88,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
