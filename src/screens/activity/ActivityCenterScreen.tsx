import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useNotifications } from '../../store/NotificationsContext';
import { useAuth } from '../../store/AuthContext';
import { ACTIVITY_CATEGORY_BY_TYPE, ACTIVITY_ICON_BY_TYPE, ActivityCategory } from '../../utils/activity';
import { formatRelativeTime } from '../../utils/date';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityCenter'>;

const FILTER_KEYS: (ActivityCategory | 'all')[] = ['all', 'points', 'requests', 'tasks', 'messages', 'goals', 'money', 'couple'];

export const ActivityCenterScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { configured } = useAuth();
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');

  const filterOptions = FILTER_KEYS.map((key) => ({ key, label: t(`activityCenter.filter_${key}`) }));

  const filtered = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((n) => ACTIVITY_CATEGORY_BY_TYPE[n.type] === filter)),
    [notifications, filter],
  );

  if (!configured) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('activityCenter.title')} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('activityCenter.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading && notifications.length > 0} onRefresh={refresh} />}
      >
        <FilterTabs options={filterOptions} value={filter} onChange={(k) => setFilter(k as ActivityCategory | 'all')} />

        {unreadCount > 0 && (
          <Pressable onPress={() => markAllRead()} style={styles.markAllRow}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>{t('activityCenter.markAllRead')}</Text>
          </Pressable>
        )}

        {loading && notifications.length === 0 && <LoadingState lines={4} />}

        {!loading && error && notifications.length === 0 && <ErrorState message={error} onRetry={refresh} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon="notification"
            title={t('activityCenter.emptyTitle')}
            description={notifications.length === 0 ? t('activityCenter.emptyDescription') : t('activityCenter.emptyFilterDescription')}
          />
        )}

        {filtered.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => !n.read && markRead(n.id)}
            style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.iconWrap}>
              <IconImage name={ACTIVITY_ICON_BY_TYPE[n.type] ?? 'notification'} size={24} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{n.title}</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {n.body}
              </Text>
              <Text style={[styles.rowTime, { color: colors.textSecondary }]}>{formatRelativeTime(n.created_at)}</Text>
            </View>
            {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.danger }]} />}
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  markAllRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
  },
  markAllText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    marginRight: spacing.md,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  rowDescription: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  rowTime: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    opacity: 0.8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: spacing.sm,
    marginTop: 6,
  },
});
