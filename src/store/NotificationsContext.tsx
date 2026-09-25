import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import * as notificationsService from '../services/supabase/notificationsService';
import * as deviceTokenService from '../services/supabase/deviceTokenService';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  configureNotificationHandler,
  registerForPushNotificationsAsync,
  setUnreadBadgeCountAsync,
} from '../services/notifications/pushService';
import { subscribeToNotifications } from '../services/supabase/realtime';
import { navigateFromNotification } from '../navigation/navigationRef';
import { getDeviceId } from '../utils/deviceId';
import { DbNotification, DbNotificationType } from '../types/database';

export interface BannerNotification {
  title: string;
  body: string;
  type: DbNotificationType;
}

interface NotificationsContextValue {
  notifications: DbNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  banner: BannerNotification | null;
  dismissBanner: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { configured, session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerNotification | null>(null);
  const registeredForUserId = useRef<string | null>(null);

  const refresh = async () => {
    if (!configured || !userId) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await notificationsService.listNotifications();
      setNotifications(rows);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, userId]);

  // Configures foreground behavior once. No-op wherever expo-notifications
  // can't safely be loaded (see pushService.ts / env.ts).
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Realtime: a brand new notification prepends to the list, bumps unread,
  // and surfaces the in-app banner immediately (no need to wait for push).
  //
  // Guarded by id: the initial `refresh()` fetch and this subscription both
  // start around mount time, so a row created in that overlap window can
  // legitimately arrive from BOTH the fetch and the realtime event -- without
  // this check it got prepended a second time, inflating both the rendered
  // list and `unreadCount` (which is just the local array's own unread
  // count) for a single real database row. Same guard protects against a
  // stray duplicate delivery if the channel is ever briefly double-subscribed
  // (e.g. a fast remount/reconnect).
  useEffect(() => {
    if (!configured || !userId) return;
    return subscribeToNotifications(userId, (row) => {
      setNotifications((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
      setBanner({ title: row.title, body: row.body, type: row.type });
    });
  }, [configured, userId]);

  // Push token registration: once per signed-in user per app session. Safe to
  // call even when it can't succeed (Expo Go on Android, no EAS project id,
  // permission denied) -- registerForPushNotificationsAsync never throws.
  useEffect(() => {
    if (!configured || !userId) {
      // Signed out: forget the registration so a later sign-in (possibly as
      // a different person on this device) registers a fresh token.
      registeredForUserId.current = null;
      return;
    }
    if (registeredForUserId.current === userId) return;
    registeredForUserId.current = userId;
    (async () => {
      const result = await registerForPushNotificationsAsync();
      if (!result.token) return;
      const deviceId = await getDeviceId();
      try {
        await deviceTokenService.upsertDeviceToken({
          userId,
          expoPushToken: result.token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceId,
        });
      } catch {
        // Non-fatal: the app works fully without a stored push token.
      }
    })();
  }, [configured, userId]);

  // Foreground listener: covers real push (once the Edge Function is
  // deployed) and the __DEV__ test screen's local notifications. Subscribes
  // to a safe no-op wherever expo-notifications can't be loaded.
  useEffect(() => {
    return addNotificationReceivedListener((event) => {
      const content = event.request.content;
      const data = content.data as unknown as { type?: DbNotificationType } | undefined;
      setBanner({
        title: content.title ?? '',
        body: content.body ?? '',
        type: data?.type ?? 'action',
      });
    });
  }, []);

  // Tapping a real push notification deep-links to the relevant screen.
  useEffect(() => {
    return addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as unknown as { type?: DbNotificationType } | undefined;
      if (data?.type) navigateFromNotification(data.type);
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setUnreadBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refresh,
      markRead: async (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        try {
          await notificationsService.markNotificationRead(id);
        } catch {
          // The optimistic patch above was never confirmed by the database --
          // re-fetch the real state instead of leaving the badge/list wrong.
          await refresh();
        }
      },
      markAllRead: async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        try {
          await notificationsService.markAllNotificationsRead();
        } catch {
          await refresh();
        }
      },
      banner,
      dismissBanner: () => setBanner(null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications, unreadCount, loading, error, banner],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};
