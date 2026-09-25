// Local-only scheduling for Reminders -- deliberately never touches remote
// push (see AGENTS.md: this app must keep working fully in Expo Go, which
// dropped remote-push support on Android in SDK 53). Same lazy-require gate
// as pushService.ts: expo-notifications is never imported at module load
// time, only from inside getNotificationsModule().
import type * as NotificationsType from 'expo-notifications';
import { isUnsupportedPushEnvironment } from './env';

let cachedModule: typeof NotificationsType | null | undefined;

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

// Maps reminder id -> the OS-scheduled local notification id, so a reminder
// can be cancelled/rescheduled without leaking a stale native notification.
// Intentionally in-memory only (lost on app restart) -- RemindersContext
// re-derives every schedule from the `reminders` table on every load, which
// is the actual source of truth.
const scheduledIds = new Map<string, string>();

export const cancelReminderNotification = async (reminderId: string): Promise<void> => {
  const Notifications = getNotificationsModule();
  const id = scheduledIds.get(reminderId);
  scheduledIds.delete(reminderId);
  if (!Notifications || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already cancelled -- nothing left to clean up.
  }
};

// Schedules a single one-off local notification for `remindAt`. Repeating
// ("weekly") reminders are NOT scheduled as a native repeating trigger --
// each occurrence is scheduled individually and rolled forward by
// RemindersContext once it fires, so every occurrence has its own
// reminder_deliveries row (see migration 0015).
export const scheduleReminderNotification = async (input: {
  reminderId: string;
  title: string;
  remindAt: Date;
}): Promise<void> => {
  await cancelReminderNotification(input.reminderId);
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (input.remindAt.getTime() <= Date.now()) return;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Напоминание CoupleUp',
        body: input.title,
        sound: false,
        data: { reminderId: input.reminderId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: input.remindAt },
    });
    scheduledIds.set(input.reminderId, id);
  } catch {
    // Local scheduling is best-effort: the reminder still exists and shows
    // in RemindersScreen even if the OS declined to schedule a local alert
    // (e.g. notification permission not granted).
  }
};
