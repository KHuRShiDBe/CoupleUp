import { Achievement } from '../types';

export interface AchievementInputs {
  actionsCount: number;
  bestStreak: number;
  earnedPointsReal: number;
  tasksCompletedCount: number;
  dateCompletedCount: number;
  goalsClosedCount: number;
  promisesCompletedCount: number;
}

const define = (id: string, current: number, target: number): Achievement => ({
  id,
  title: id, // display text comes from t(`achievements.${id}`) at render time
  current: Math.min(current, target),
  target,
  unlocked: current >= target,
});

// Real criteria only -- every `current` value here comes from an actual
// count of real rows (actions/tasks/promises/etc), nothing is seeded or
// pre-unlocked. Whether an achievement STAYS unlocked once a live stat drops
// (e.g. streak resetting) is handled separately by the persisted
// achievement_unlocks table, not by this pure function.
export const computeAchievementDefs = (inputs: AchievementInputs): Achievement[] => [
  define('firstStep', inputs.actionsCount, 1),
  define('sevenDays', inputs.bestStreak, 7),
  define('thousandPoints', inputs.earnedPointsReal, 1000),
  define('teamwork', inputs.tasksCompletedCount, 10),
  define('dateNight', inputs.dateCompletedCount, 1),
  define('goalGetter', inputs.goalsClosedCount, 1),
  define('promiseKeeper', inputs.promisesCompletedCount, 5),
];
