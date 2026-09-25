import { ReminderRule } from '../types/database';

// Deliberately not a calendar engine: every rule resolves to exactly one
// fixed local time (REMINDER_HOUR) on a computed day. No per-reminder time
// picker, no timezone/recurrence-rule parsing.
export const REMINDER_HOUR = 10;

const atReminderHour = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(REMINDER_HOUR, 0, 0, 0);
  return copy;
};

// Computes the first remind_at for a freshly created reminder. `specificDate`
// is a plain "YYYY-MM-DD" string, required only for rule 'specific_date'.
export const computeInitialRemindAt = (rule: ReminderRule, specificDate?: string): Date => {
  const now = new Date();
  switch (rule) {
    case 'today': {
      const at = atReminderHour(now);
      // REMINDER_HOUR already passed today -- fire soon instead of silently
      // scheduling something in the past (which would just never fire).
      return at.getTime() > now.getTime() ? at : new Date(now.getTime() + 5 * 60000);
    }
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return atReminderHour(d);
    }
    case 'in_3_days': {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      return atReminderHour(d);
    }
    case 'specific_date': {
      if (!specificDate) return atReminderHour(now);
      const [y, m, day] = specificDate.split('-').map((part) => parseInt(part, 10));
      if (!y || !m || !day) return atReminderHour(now);
      return atReminderHour(new Date(y, m - 1, day));
    }
    case 'weekly': {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return atReminderHour(d);
    }
    default:
      return atReminderHour(now);
  }
};

// Rolls a past due date for a weekly-repeating reminder forward to the next
// future occurrence (usually +7 days, but +14/+21/... covers the app having
// been closed for more than a week so it doesn't fire a burst of overdue
// notifications the moment it reopens).
export const rollWeeklyForward = (remindAt: Date): Date => {
  const next = new Date(remindAt);
  while (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
};
