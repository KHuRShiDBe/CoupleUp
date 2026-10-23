import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useMockLoading } from '../../hooks/useMockLoading';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useNotifications } from '../../store/NotificationsContext';
import { IconName } from '../../types';
import { DbActionRequest } from '../../types/database';
import { TranslationKey, useTranslation } from '../../localization/useTranslation';
import { formatRelativeTime } from '../../utils/date';
import { haptics } from '../../utils/haptics';

const CLOUD_ICON_BY_TYPE: Record<string, IconName> = {
  action: 'tasks',
  task: 'tasks',
  task_done: 'tasks',
  reward_request: 'rewards',
  reward_response: 'rewards',
  penalty: 'lock',
  penalty_response: 'lock',
  goal: 'goal',
  action_request: 'tasks',
  action_response: 'tasks',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface NotificationEntry {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  date: string;
}

export const NotificationsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const loading = useMockLoading();
  const { history, rewardRequests, penalties, completedTasks, sharedGoals, achievements, notificationPreferences } =
    useAppStore();
  const { configured, session } = useAuth();
  const myId = session?.user?.id;
  const sync = useCoupleSync();
  const budget = useBudget();
  // Requests (accept/decline reward requests, purchase requests, penalties)
  // is a separate actionable queue, not part of this read-only feed -- shown
  // here as a banner since this screen (not the bottom tab bar) is now the
  // only entry point into notifications, reached via Home's bell button.
  const pendingRequestsCount = sync.pendingRequestsCount + budget.purchaseRequests.filter((p) => p.status === 'pending').length;
  const {
    notifications: cloudNotifications,
    unreadCount,
    loading: cloudLoading,
    error: cloudError,
    refresh: refreshCloud,
    markRead,
    markAllRead,
  } = useNotifications();

  // Opening this screen is "I've seen my notifications" -- same rule Chat
  // already uses for its own unread badge. Fires once on mount and again
  // only when the list actually grows (a new one arrives via realtime while
  // this screen is open), not on every render -- same ref-based guard as
  // ChatScreen.tsx uses for its own markRead-on-open effect.
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;
  useEffect(() => {
    if (unreadCount > 0) markAllReadRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudNotifications.length]);

  const entries = useMemo<NotificationEntry[]>(() => {
    const list: NotificationEntry[] = [];
    const prefs = notificationPreferences;

    if (prefs.actions) {
      history
        .slice(0, 5)
        .forEach((h) =>
          list.push({ id: `action-${h.id}`, icon: 'tasks', title: t('notifications.newAction'), description: h.title, date: h.date }),
        );
    }

    if (prefs.rewardRequests) {
      rewardRequests
        .filter((r) => r.status === 'pending')
        .forEach((r) =>
          list.push({
            id: `reward-${r.id}`,
            icon: 'rewards',
            title: t('notifications.newRewardRequest'),
            description: r.title,
            date: r.date,
          }),
        );
    }

    if (prefs.penalties) {
      penalties
        .filter((p) => p.status === 'pending')
        .forEach((p) =>
          list.push({
            id: `penalty-${p.id}`,
            icon: 'lock',
            title: t('notifications.penaltyPending'),
            description: p.title,
            date: p.date,
          }),
        );
    }

    if (prefs.tasks) {
      completedTasks
        .slice(0, 5)
        .forEach((task) =>
          list.push({
            id: `task-${task.id}`,
            icon: 'tasks',
            title: t('notifications.taskDone'),
            description: task.title,
            date: '',
          }),
        );
    }

    if (prefs.goals) {
      sharedGoals
        .filter((g) => g.currentPoints >= g.targetPoints)
        .forEach((g) =>
          list.push({
            id: `goal-${g.id}`,
            icon: 'goal',
            title: t('notifications.goalReached'),
            description: g.title,
            date: '',
          }),
        );
    }

    if (prefs.achievements) {
      achievements
        .filter((a) => a.unlocked)
        .forEach((a) =>
          list.push({
            id: `achievement-${a.id}`,
            icon: 'achievement',
            title: t('notifications.newAchievement'),
            description: t(`achievements.${a.id}` as TranslationKey),
            date: '',
          }),
        );
    }

    return list;
  }, [history, rewardRequests, penalties, completedTasks, sharedGoals, achievements, notificationPreferences, t]);

  const respondToActionRequest = (id: string, accept: boolean) => {
    haptics.success();
    sync.respondActionRequest(id, accept);
  };

  const actionRequestStatusLabel = (ar: DbActionRequest): string => {
    if (ar.status === 'approved') return t('notifications.actionRequestStatusApproved');
    if (ar.status === 'rejected') return t('notifications.actionRequestStatusRejected');
    return t('notifications.actionRequestStatusPending');
  };

  const actionRequestStatusColor = (ar: DbActionRequest): string => {
    if (ar.status === 'approved') return colors.success;
    if (ar.status === 'rejected') return colors.danger;
    return colors.textSecondary;
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('notifications.title')} onBack={() => navigation.goBack()} />
      {loading ? (
        <LoadingState />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {pendingRequestsCount > 0 && (
            <Pressable
              onPress={() => navigation.navigate('Requests')}
              style={[styles.requestsBanner, shadow.soft, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.requestsBannerText, { color: colors.textOnPrimary }]}>
                {t('notifications.pendingRequestsBanner', { count: pendingRequestsCount })}
              </Text>
              <Text style={[styles.requestsBannerArrow, { color: colors.textOnPrimary }]}>→</Text>
            </Pressable>
          )}
          {configured ? (
            // Real backend available: show ONLY the real, synced notification
            // log. Previously this also rendered the legacy `entries` list
            // (derived from local-only AsyncStorage mock data) unconditionally
            // below, so a signed-in user saw the same events twice -- once
            // real, once as a stale local echo.
            <>
              {cloudLoading && cloudNotifications.length === 0 && <LoadingState lines={3} />}
              {cloudError && <ErrorState message={cloudError} onRetry={refreshCloud} />}
              {!cloudLoading && !cloudError && cloudNotifications.length === 0 && (
                <EmptyState icon="notification" title={t('notifications.emptyTitle')} description={t('notifications.emptyDescription')} />
              )}
              {cloudNotifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <Pressable onPress={() => markAllRead()} style={styles.markAllRow}>
                      <Text style={[styles.markAllText, { color: colors.primary }]}>{t('notifications.markAllRead')}</Text>
                    </Pressable>
                  )}
                  {cloudNotifications.map((n) => {
                    // action_request/action_response carry an exact, live
                    // entity_id into the already-synced action_requests list
                    // -- cross-referencing it (rather than trusting the
                    // notification's own frozen title/body for status) means
                    // the ✓/✕ buttons and status line always reflect the
                    // CURRENT state, not whatever it was the instant this
                    // notification was created.
                    const actionRequest =
                      n.type === 'action_request' || n.type === 'action_response'
                        ? sync.actionRequests.find((ar) => ar.id === n.entity_id)
                        : undefined;
                    const canRespond =
                      n.type === 'action_request' && !!actionRequest && actionRequest.status === 'pending' && actionRequest.reviewer_user_id === myId;

                    return (
                      <Pressable
                        key={n.id}
                        onPress={() => !n.read && markRead(n.id)}
                        style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <View style={styles.iconWrap}>
                          <IconImage name={CLOUD_ICON_BY_TYPE[n.type] ?? 'notification'} size={24} />
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={[styles.rowTitle, { color: colors.text }]}>{n.title}</Text>
                          <Text style={[styles.rowDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                            {n.body}
                          </Text>
                          <View style={styles.rowMetaRow}>
                            <Text style={[styles.rowTime, { color: colors.textSecondary }]}>{formatRelativeTime(n.created_at)}</Text>
                            {!!actionRequest && (
                              <Text style={[styles.rowStatus, { color: actionRequestStatusColor(actionRequest) }]}>
                                {actionRequestStatusLabel(actionRequest)}
                              </Text>
                            )}
                          </View>
                          {canRespond && actionRequest && (
                            <View style={styles.actionRequestButtons}>
                              <Pressable
                                onPress={() => respondToActionRequest(actionRequest.id, true)}
                                style={[styles.actionRequestButton, { backgroundColor: colors.success }]}
                              >
                                <Text style={styles.actionRequestButtonText}>✓</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => respondToActionRequest(actionRequest.id, false)}
                                style={[styles.actionRequestButton, { backgroundColor: colors.danger }]}
                              >
                                <Text style={styles.actionRequestButtonText}>✕</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                        {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.danger }]} />}
                      </Pressable>
                    );
                  })}
                </>
              )}
            </>
          ) : entries.length === 0 ? (
            <EmptyState icon="notification" title={t('notifications.emptyTitle')} description={t('notifications.emptyDescription')} />
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.iconWrap}>
                  <IconImage name={entry.icon} size={24} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{entry.title}</Text>
                  <Text style={[styles.rowDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                    {entry.description}
                  </Text>
                </View>
                {!!entry.date && <Text style={[styles.date, { color: colors.textSecondary }]}>{entry.date}</Text>}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  requestsBannerText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  requestsBannerArrow: {
    fontSize: fontSize.lg,
    fontWeight: '700',
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
  date: {
    fontSize: fontSize.xs,
    marginLeft: spacing.sm,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  rowTime: {
    fontSize: fontSize.xs,
  },
  rowStatus: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  actionRequestButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionRequestButton: {
    width: 40,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRequestButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  markAllRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
  },
  markAllText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
});
