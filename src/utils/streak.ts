export interface StreakInfo {
  current: number;
  best: number;
  thisWeek: number;
}

// dates: 'YYYY-MM-DD' log dates for one habit, any order, duplicates fine.
export const computeStreak = (dates: string[]): StreakInfo => {
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return { current: 0, best: 0, thisWeek: 0 };

  const dayMs = 86400000;
  const toTime = (d: string) => new Date(d).getTime();

  // Longest run of consecutive calendar days.
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const gap = Math.round((toTime(unique[i]) - toTime(unique[i - 1])) / dayMs);
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  // Current streak: consecutive days ending today or yesterday (a gap of one
  // day -- "not done yet today" -- doesn't break it).
  const todaySet = new Set(unique);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  let cursor = new Date(today);
  if (!todaySet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (todaySet.has(cursor.toISOString().slice(0, 10))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const weekCutoff = Date.now() - 7 * dayMs;
  const thisWeek = unique.filter((d) => toTime(d) >= weekCutoff).length;

  return { current, best, thisWeek };
};
