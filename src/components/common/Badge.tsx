import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props {
  count: number;
}

// Renders nothing when count is 0, per spec ("если запросов 0 — badge не показывать").
export const Badge = ({ count }: Props) => {
  const { colors } = useTheme();
  if (count <= 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.card }]}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
