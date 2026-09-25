export const isThisMonth = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export const isThisYear = (iso: string): boolean => new Date(iso).getFullYear() === new Date().getFullYear();

export const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

// Rolling window (e.g. "last 7 days"), not calendar-week-aligned -- simpler
// and matches how "this week" reads intuitively in a Fairness/Weekly Summary
// context.
export const isWithinDays = (iso: string, days: number): boolean => {
  const cutoff = Date.now() - days * 86400000;
  return new Date(iso).getTime() >= cutoff;
};

// Compact relative time for activity/notification feeds ("только что", "5 мин
// назад", "3 ч назад", falling back to a plain date once it's more than a day
// old -- no need for a full i18n-relative-time library for this).
export const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString();
};

// Recurring yearly: days until the next occurrence of this month/day (today
// if it's today, otherwise rolls to next year once this year's date passed).
// Used for anniversaries/birthdays -- and for the Calendar month grid.
export const daysUntilNextOccurrence = (isoDate: string): number => {
  const target = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), target.getMonth(), target.getDate());
  if (next < today) next = new Date(now.getFullYear() + 1, target.getMonth(), target.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86400000);
};
