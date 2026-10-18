import { fromDateKey } from "./recurrence";

export type DeadlineTone = "crossed" | "today" | "soon" | "later";

export const DEADLINE_TONE_CLASS: Record<DeadlineTone, string> = {
  crossed: "text-destructive",
  today: "text-destructive",
  soon: "text-amber-600 dark:text-amber-400",
  later: "text-muted-foreground",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// How a task's deadline reads in a list. A missed one says so plainly and
// counts the days since, rather than a terse "3d overdue". Dates are
// calendar days in local time, never parsed as UTC.
export function deadlineLabel(dueDate: string | null, done = false): { text: string; tone: DeadlineTone } | null {
  if (!dueDate || done) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = fromDateKey(dueDate);
  const delta = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (delta < 0) return { text: `Deadline crossed · ${plural(-delta, "day")} ago`, tone: "crossed" };
  if (delta === 0) return { text: "Due today", tone: "today" };
  if (delta === 1) return { text: "Due tomorrow", tone: "soon" };
  if (delta <= 6) return { text: `Due in ${plural(delta, "day")}`, tone: "soon" };
  const sameYear = due.getFullYear() === today.getFullYear();
  return {
    text: `Due ${due.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })}`,
    tone: "later",
  };
}
