import type { Recurrence } from "./database.types";

export const RECURRENCES: Recurrence[] = ["daily", "weekdays", "weekly", "monthly"];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  monthly: "Every month",
};

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === "string" && (RECURRENCES as string[]).includes(value);
}

// Dates in this app are plain calendar days ("2026-09-10"), so all of the
// arithmetic here is done in local time on a day boundary — never through
// UTC, which would shift a date by one near midnight.
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function advance(from: Date, recurrence: Recurrence): Date {
  const next = new Date(from);
  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekdays":
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly": {
      // Jan 31 + 1 month is "Feb 28", not "Mar 3": clamp to the last day.
      const day = from.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      break;
    }
  }
  return next;
}

// The due date of the occurrence that follows `dueDate`. It keeps to the
// task's own rhythm (a weekly Monday task stays on Mondays even if you
// tick it on Wednesday), but never lands in the past: finishing a task a
// month late must not leave a stack of overdue copies behind it.
export function nextOccurrence(dueDate: string | null, recurrence: Recurrence, today = new Date()): string {
  const floor = startOfDay(today);
  let next = advance(dueDate ? fromDateKey(dueDate) : floor, recurrence);
  // Bounded: a pathological far-past date can't spin forever.
  for (let i = 0; i < 2000 && next <= floor; i++) next = advance(next, recurrence);
  return toDateKey(next);
}
