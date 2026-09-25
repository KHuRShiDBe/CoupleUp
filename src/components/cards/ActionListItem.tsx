import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ActionHistoryItem } from '../../types';
import { Avatar } from '../common/Avatar';
import { useAppStore } from '../../store/AppContext';

interface Props {
  item: ActionHistoryItem;
}

export const ActionListItem = ({ item }: Props) => {
  const { colors, role } = useTheme();
  const { selectedAvatar } = useAppStore();
  const isPositive = item.points >= 0;
  const isMine = item.authorRole === role;
  const avatarId = item.avatarId !== undefined ? item.avatarId : isMine ? selectedAvatar : 1;

  return (
    <View style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar role={item.authorRole} avatarId={avatarId} size={40} />
      <View style={styles.body}>
        {!!item.arrowLabel && (
          <Text style={[styles.arrowLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.arrowLabel}
          </Text>
        )}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{item.date}</Text>
      </View>
      <Text style={[styles.points, { color: isPositive ? colors.success : colors.danger }]}>
        {isPositive ? '+' : ''}
        {item.points}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
  },
  arrowLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  date: {
    fontSize: fontSize.xs,
  },
  points: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
});
