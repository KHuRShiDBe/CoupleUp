import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';
import { DbNotificationType } from '../types/database';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Maps a server notification's event type to the screen that shows it. Kept
// deliberately coarse (screen-level, not a specific list item) -- entity_id
// isn't a dedicated param on any of these screens, and the target screen
// already lists the relevant item once opened.
export const routeForNotificationType = (type: DbNotificationType): keyof RootStackParamList => {
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
    case 'wish_completion_request':
    case 'wish_completion_response':
    case 'wish_important':
      return 'Wishlist';
    case 'prize_use_request':
      return 'Savings';
    case 'action':
    default:
      return 'Notifications';
  }
};

export const navigateFromNotification = (type: DbNotificationType): void => {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(routeForNotificationType(type) as never);
};
