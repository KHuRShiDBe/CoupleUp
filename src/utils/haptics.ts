import * as Haptics from 'expo-haptics';

// Thin wrappers so call sites read like intent, not raw Haptics calls, and so
// we only vibrate at moments that are actually meaningful -- never on every tap.
export const haptics = {
  select: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  confirm: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
