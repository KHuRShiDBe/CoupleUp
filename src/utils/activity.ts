import { DbNotificationType } from '../types/database';
import { IconName } from '../types';

// Client-side categorization only -- deliberately NOT a new `category` column
// on `notifications`, since it's a pure function of `type` and adding a
// column would just be a second place this mapping could drift out of sync.
export type ActivityCategory = 'points' | 'requests' | 'tasks' | 'messages' | 'goals' | 'money' | 'couple';

export const ACTIVITY_CATEGORY_BY_TYPE: Record<DbNotificationType, ActivityCategory> = {
  action: 'points',
  compliment: 'points',
  task: 'tasks',
  task_done: 'tasks',
  reward_request: 'requests',
  reward_response: 'requests',
  purchase_request: 'money',
  purchase_response: 'money',
  penalty: 'couple',
  penalty_response: 'couple',
  goal: 'goals',
  goal_completed: 'goals',
  promise_completed: 'couple',
  challenge_completed: 'couple',
  nudge: 'couple',
  action_request: 'requests',
  action_response: 'requests',
  wish_completion_request: 'requests',
  wish_completion_response: 'requests',
  prize_use_request: 'requests',
  wish_important: 'requests',
};

export const ACTIVITY_ICON_BY_TYPE: Record<DbNotificationType, IconName> = {
  action: 'tasks',
  compliment: 'message',
  task: 'tasks',
  task_done: 'tasks',
  reward_request: 'rewards',
  reward_response: 'rewards',
  purchase_request: 'shop',
  purchase_response: 'shop',
  penalty: 'lock',
  penalty_response: 'lock',
  goal: 'goal',
  goal_completed: 'achievement',
  promise_completed: 'pair',
  challenge_completed: 'achievement',
  nudge: 'notification',
  action_request: 'tasks',
  action_response: 'tasks',
  wish_completion_request: 'wishlist',
  wish_completion_response: 'wishlist',
  prize_use_request: 'rewards',
  wish_important: 'wishlist',
};
