import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
// Type-only: erased at compile time, so this line never touches the native
// module at runtime. All *runtime* access to expo-notifications goes through
// getNotificationsModule() below, which is the only place in this codebase
// allowed to actually load it.
import type * as NotificationsType from 'expo-notifications';
import { isUnsupportedPushEnvironment } from './env';

export type PushRegistrationFailureReason =
  | 'not-device'
  | 'expo-go-android'
  | 'permission-denied'
  | 'no-project-id'
  | 'error';

export interface PushRegistrationResult {
  token: string | null;
  reason?: PushRegistrationFailureReason;
}

let cachedModule: typeof NotificationsType | null | undefined;

// Lazily requires expo-notifications -- never at import time, and never at
// all in Expo Go on Android, where SDK 53 removed remote-push support so
// thoroughly that even loading the native module can crash the app on
// startup (not just calling getExpoPushTokenAsync). Every other function in
// this file goes through this gate instead of importing the module directly.
const getNotificationsModule = (): typeof NotificationsType | null => {
  if (cachedModule !== undefined) return cachedModule;
  if (isUnsupportedPushEnvironment()) {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require('expo-notifications') as typeof NotificationsType;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
};

// Foreground notifications never show the OS banner/sound -- the app shows
// its own in-app banner instead (see InAppNotificationBanner). The badge
// count still updates so the app icon stays accurate. No-ops wherever the
// module can't be loaded. Safe to call more than once (just replaces the handler).
export const configureNotificationHandler = (): void => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
};

// Registers this device for push and returns its Expo push token, or a typed
// reason it couldn't. Never throws -- every failure path (unsupported
// environment, no physical device, permission denied, missing EAS project
// id, network/API error) degrades to `{ token: null, reason }` so callers
// can show a clear message instead of crashing.
export const registerForPushNotificationsAsync = async (): Promise<PushRegistrationResult> => {
  if (isUnsupportedPushEnvironment()) {
    return { token: null, reason: 'expo-go-android' };
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return { token: null, reason: 'error' };
  }

  if (!Device.isDevice) {
    return { token: null, reason: 'not-device' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#2F80ED',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { token: null, reason: 'permission-denied' };
  }

  // getExpoPushTokenAsync requires an EAS project id -- there is none here
  // because this project intentionally never runs EAS. Once a real dev/prod
  // build is created with `eas build` and app.json gets an `extra.eas.projectId`,
  // this starts working with no code changes.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return { token: null, reason: 'no-project-id' };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data };
  } catch {
    return { token: null, reason: 'error' };
  }
};

// Only meaningful permission status this app can query today; returns
// 'undetermined' wherever the module can't be loaded (unsupported
// environment) so callers don't need their own environment check.
export const getNotificationPermissionStatusAsync = async (): Promise<
  'granted' | 'denied' | 'undetermined'
> => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return 'undetermined';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'undetermined';
  }
};

export const getUnreadBadgeCountAsync = async (): Promise<number> => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return 0;
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
};

export const setUnreadBadgeCountAsync = async (count: number): Promise<boolean> => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;
  try {
    return await Notifications.setBadgeCountAsync(count);
  } catch {
    return false;
  }
};

// Used only by the __DEV__-only NotificationTestScreen: schedules a real local
// notification so the full permission -> handler -> foreground-banner
// pipeline can be exercised without a backend or a custom dev client. No-ops
// wherever expo-notifications can't be loaded.
export const scheduleLocalTestNotification = async (title: string, body: string): Promise<void> => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: null,
  });
};

// Registers a foreground-notification-received listener. Returns a no-op
// unsubscribe wherever the module can't be loaded, so callers never need
// their own environment check before subscribing.
export const addNotificationReceivedListener = (
  listener: (event: NotificationsType.Notification) => void,
): (() => void) => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationReceivedListener(listener);
  return () => subscription.remove();
};

// Registers a notification-tapped listener. Same no-op-safe contract as above.
export const addNotificationResponseReceivedListener = (
  listener: (event: NotificationsType.NotificationResponse) => void,
): (() => void) => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener(listener);
  return () => subscription.remove();
};
