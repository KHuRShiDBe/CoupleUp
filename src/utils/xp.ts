import { CoupleLevelInfo } from '../types';

// Single source of truth for how much XP each kind of real activity is
// worth, and where the level thresholds sit -- nothing here is fake/random,
// every input is a count of real rows (actions, habit logs, promises,
// completed weekly challenges, days both partners answered Question of the
// Day). Opening the app awards nothing.
export const XP_WEIGHTS = {
  action: 5,
  task: 10,
  questionBothAnswered: 8,
  habitLog: 3,
  promiseCompleted: 15,
  weeklyChallengeCompleted: 25,
} as const;

export interface XpInputs {
  actionsCount: number;
  tasksCompletedCount: number;
  questionsBothAnsweredCount: number;
  habitLogsCount: number;
  promisesCompletedCount: number;
  weeklyChallengesCompletedCount: number;
}

export const computeCoupleXp = (inputs: XpInputs): number =>
  inputs.actionsCount * XP_WEIGHTS.action +
  inputs.tasksCompletedCount * XP_WEIGHTS.task +
  inputs.questionsBothAnsweredCount * XP_WEIGHTS.questionBothAnswered +
  inputs.habitLogsCount * XP_WEIGHTS.habitLog +
  inputs.promisesCompletedCount * XP_WEIGHTS.promiseCompleted +
  inputs.weeklyChallengesCompletedCount * XP_WEIGHTS.weeklyChallengeCompleted;

// Widening gaps -- each level takes meaningfully more real activity than
// the last, matching "не хардкодить формулы в screen": screens only ever
// call computeLevel(), never touch these numbers directly.
export const XP_LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];

export const computeLevel = (xp: number): CoupleLevelInfo => {
  let levelIndex = 0;
  for (let i = 0; i < XP_LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= XP_LEVEL_THRESHOLDS[i]) levelIndex = i;
  }
  const currentThreshold = XP_LEVEL_THRESHOLDS[levelIndex];
  const nextThreshold = XP_LEVEL_THRESHOLDS[levelIndex + 1] ?? null;
  const progress = nextThreshold ? (xp - currentThreshold) / (nextThreshold - currentThreshold) : 1;
  return {
    level: levelIndex + 1,
    currentPoints: xp,
    currentThreshold,
    nextThreshold,
    progress: Math.min(1, Math.max(0, progress)),
    remaining: nextThreshold ? Math.max(0, nextThreshold - xp) : 0,
  };
};
