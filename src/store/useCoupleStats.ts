import { useMemo } from 'react';
import { useCoupleSync } from './CoupleSyncContext';
import { usePlanning } from './PlanningContext';
import { useCoupleInteraction } from './CoupleInteractionContext';
import { useProgression } from './ProgressionContext';
import { computeCoupleXp, computeLevel } from '../utils/xp';
import { computeAchievementDefs } from '../utils/achievements';

// Single source of truth for every screen that needs real XP/level/
// achievements/streak numbers (CoupleProfile, Achievements, Home, Reward
// Chest) -- so the formulas in utils/xp.ts and utils/achievements.ts are
// never duplicated or re-hardcoded inside a screen component.
export const useCoupleStats = () => {
  const sync = useCoupleSync();
  const planning = usePlanning();
  const interaction = useCoupleInteraction();
  const progression = useProgression();

  // Real, couple-shared counts -- NOT the legacy per-device AsyncStorage
  // mock (`useAppStore().completedTasks`/`sharedGoals`), which used to feed
  // XP/achievements here. That local store never syncs between partners, so
  // two phones could compute two different XP totals/levels for what's
  // supposed to be one shared stat. `sync.tasks`/`sync.goals` come from the
  // real `tasks`/`goals` tables via CoupleSyncContext.
  const tasksCompletedCount = useMemo(() => sync.tasks.filter((t) => t.status === 'completed').length, [sync.tasks]);
  const goalsClosedCount = useMemo(
    () => sync.goals.filter((g) => g.current_points >= g.target_points).length,
    [sync.goals],
  );

  const questionsBothAnsweredCount = useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    interaction.dailyAnswers.forEach((a) => {
      if (!byDate.has(a.question_date)) byDate.set(a.question_date, new Set());
      byDate.get(a.question_date)!.add(a.user_id);
    });
    let count = 0;
    byDate.forEach((users) => {
      if (users.size >= 2) count += 1;
    });
    return count;
  }, [interaction.dailyAnswers]);

  const promisesCompletedCount = useMemo(
    () => planning.promises.filter((p) => p.status === 'completed').length,
    [planning.promises],
  );

  const dateCompletedCount = useMemo(
    () => planning.planItems.filter((p) => p.kind === 'date' && p.done).length,
    [planning.planItems],
  );

  const xp = useMemo(
    () =>
      computeCoupleXp({
        actionsCount: sync.actionsList.length,
        tasksCompletedCount,
        questionsBothAnsweredCount,
        habitLogsCount: planning.habitLogs.length,
        promisesCompletedCount,
        weeklyChallengesCompletedCount: progression.totalCompletedChallenges,
      }),
    [
      sync.actionsList.length,
      tasksCompletedCount,
      questionsBothAnsweredCount,
      planning.habitLogs.length,
      promisesCompletedCount,
      progression.totalCompletedChallenges,
    ],
  );

  const level = useMemo(() => computeLevel(xp), [xp]);

  const currentStreak = sync.couple?.couple_streak ?? 0;
  const bestStreak = sync.couple?.best_couple_streak ?? 0;

  const achievements = useMemo(
    () =>
      computeAchievementDefs({
        actionsCount: sync.actionsList.length,
        bestStreak,
        earnedPointsReal: sync.couple?.earned_points ?? 0,
        tasksCompletedCount,
        dateCompletedCount,
        goalsClosedCount,
        promisesCompletedCount,
      }),
    [
      sync.actionsList.length,
      bestStreak,
      sync.couple?.earned_points,
      tasksCompletedCount,
      dateCompletedCount,
      goalsClosedCount,
      promisesCompletedCount,
    ],
  );

  return { xp, level, achievements, currentStreak, bestStreak };
};
