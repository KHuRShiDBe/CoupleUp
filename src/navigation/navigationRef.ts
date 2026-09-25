import { createNavigationContainerRef } from '@react-navigation/native';
import { MainTabParamList, RootStackParamList } from './types';
import { DbNotificationType } from '../types/database';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Maps a server notification's event type to the screen that shows it. Kept
// deliberately coarse (screen-level, not a specific list item) -- entity_id
// isn't a dedicated param on any of these screens, and the target screen
// already lists the relevant item once opened.
// `Notifications` is a bottom tab (MainTabParamList), not a root stack route
// -- the rest stay root-stack screens.
export const routeForNotificationType = (type: DbNotificationType): keyof RootStackParamList | keyof MainTabParamList => {
  switch (type) {
    case 'reward_request':
    case 'reward_response':
    case 'penalty':
    case 'penalty_response':
      return 'Requests';
    case 'task':
    case 'task_done':
      return 'Tasks';
    case 'goal':
      return 'SharedGoals';
    case 'action':
    default:
      return 'Notifications';
  }
};

export const navigateFromNotification = (type: DbNotificationType): void => {
  if (!navigationRef.isReady()) return;
  const route = routeForNotificationType(type);
  // `Notifications` lives inside the bottom tab navigator (the `Main` stack
  // screen), not directly on the root stack -- needs the nested-navigate form.
  if (route === 'Notifications') {
    (navigationRef.navigate as (...args: unknown[]) => void)('Main', { screen: 'Notifications' });
    return;
  }
  navigationRef.navigate(route as never);
};
