import type { Recurrence, TaskPriority, Track } from "./database.types";
import { fromDateKey, toDateKey } from "./recurrence";

// Turns one line of ordinary writing into a task:
//
//   "buy a book tomorrow !high"      -> due tomorrow, high priority
//   "practice scales every weekday"  -> repeats on weekdays
//   "read chapter 4 on friday #cpp"  -> due Friday, in the track matching "cpp"
//
// The text that was understood is removed from the title; anything that
// isn't understood stays in it, so nothing you typed is lost.

export interface QuickAdd {
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  recurrence: Recurrence | null;
  // The "#word" you typed, to be matched against track names.
  trackHint: string | null;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const FULL_DAY = WEEKDAYS.join("|");
const ABBR_DAY = WEEKDAY_ABBR.join("|");
const MONTH_RX = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";

function dayIndex(word: string): number {
  const w = word.toLowerCase();
  const full = WEEKDAYS.indexOf(w);
  return full >= 0 ? full : WEEKDAY_ABBR.indexOf(w.slice(0, 3));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// The next time `weekday` comes round, never today itself.
function nextWeekday(from: Date, weekday: number): Date {
  const delta = ((weekday - from.getDay() + 7) % 7) || 7;
  return addDays(from, delta);
}

function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target;
}

// Removes the first match of `rx` and hands back what it captured.
function take(state: { text: string }, rx: RegExp): RegExpExecArray | null {
  const m = rx.exec(state.text);
  if (!m) return null;
  state.text = (state.text.slice(0, m.index) + " " + state.text.slice(m.index + m[0].length)).replace(/\s+/g, " ");
  return m;
}

export function parseQuickAdd(input: string, now = new Date()): QuickAdd {
  const today = startOfDay(now);
  const state = { text: ` ${input.trim()} ` };
  let priority: TaskPriority = "none";
  let dueDate: Date | null = null;
  let recurrence: Recurrence | null = null;
  let trackHint: string | null = null;

  // Explicit tags, the same ones Markdown import uses.
  let m = take(state, /\s#priority:(low|medium|high)\b/i);
  if (m) priority = m[1].toLowerCase() as TaskPriority;
  m = take(state, /\s#due:(\d{4}-\d{2}-\d{2})\b/i);
  if (m && !Number.isNaN(Date.parse(m[1]))) dueDate = fromDateKey(m[1]);
  m = take(state, /\s#repeat:(daily|weekdays|weekly|monthly)\b/i);
  if (m) recurrence = m[1].toLowerCase() as Recurrence;

  // #track
  m = take(state, /\s#([\p{L}\p{N}_-]+)(?=\s)/u);
  if (m) trackHint = m[1];

  // Priority: !high  !med  !low  !1 !2 !3
  m = take(state, /\s!(high|medium|med|low|h|m|l|1|2|3)(?=\s)/i);
  if (m) {
    const v = m[1].toLowerCase();
    priority = v === "high" || v === "h" || v === "1" ? "high" : v === "low" || v === "l" || v === "3" ? "low" : "medium";
  }

  // Repeats. "every monday" also pins the first date.
  let repeatWeekday: number | null = null;
  if (!recurrence) {
    // "every monday" and "every weekday" before the bare words: the title
    // "weekly review every monday" must not give up its "weekly".
    if ((m = take(state, /\severy\s+weekdays?(?=\s)/i))) recurrence = "weekdays";
    else if ((m = take(state, new RegExp(`\\severy\\s+(${FULL_DAY}|${ABBR_DAY})(?=\\s)`, "i")))) {
      recurrence = "weekly";
      repeatWeekday = dayIndex(m[1]);
    } else if ((m = take(state, /\s(?:every\s*day|daily)(?=\s)/i))) recurrence = "daily";
    else if ((m = take(state, /\s(?:every\s+week|weekly)(?=\s)/i))) recurrence = "weekly";
    else if ((m = take(state, /\s(?:every\s+month|monthly)(?=\s)/i))) recurrence = "monthly";
  }

  // Dates. The first one found wins.
  if (!dueDate) {
    if (take(state, /\s(?:today|tonight)(?=\s)/i)) dueDate = today;
    else if (take(state, /\s(?:tomorrow|tmrw|tmr)(?=\s)/i)) dueDate = addDays(today, 1);
    else if (take(state, /\snext\s+week(?=\s)/i)) dueDate = addDays(today, 7);
    else if (take(state, /\snext\s+month(?=\s)/i)) dueDate = addMonths(today, 1);
    else if ((m = take(state, /\sin\s+(\d{1,3})\s+(day|week|month)s?(?=\s)/i))) {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      dueDate = unit === "day" ? addDays(today, n) : unit === "week" ? addDays(today, n * 7) : addMonths(today, n);
    } else if ((m = take(state, /\s(\d{4}-\d{2}-\d{2})(?=\s)/))) {
      if (!Number.isNaN(Date.parse(m[1]))) dueDate = fromDateKey(m[1]);
    } else if ((m = take(state, new RegExp(`\\s(?:on|next|this)\\s+(${FULL_DAY}|${ABBR_DAY})(?=\\s)`, "i")))) {
      dueDate = nextWeekday(today, dayIndex(m[1]));
    } else if ((m = take(state, new RegExp(`\\s(${FULL_DAY})(?=\\s)`, "i")))) {
      dueDate = nextWeekday(today, dayIndex(m[1]));
    } else if (
      (m = take(state, new RegExp(`\\s(${MONTH_RX})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, "i"))) ||
      (m = take(state, new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RX})\\.?(?=\\s)`, "i")))
    ) {
      const monthWord = /^\d/.test(m[1]) ? m[2] : m[1];
      const dayNum = Number(/^\d/.test(m[1]) ? m[1] : m[2]);
      const month = MONTHS.indexOf(monthWord.toLowerCase().slice(0, 3));
      if (month >= 0 && dayNum >= 1 && dayNum <= 31) {
        let d = new Date(today.getFullYear(), month, dayNum);
        if (d.getMonth() !== month) d = today; // e.g. "feb 31" isn't a date
        else if (d < today) d = new Date(today.getFullYear() + 1, month, dayNum);
        dueDate = d;
      }
    }
  }

  if (recurrence && !dueDate) {
    dueDate = repeatWeekday !== null ? nextWeekday(today, repeatWeekday) : today;
  }

  // What's left is the title, minus connecting words stranded at the end
  // ("call mum on" once "friday" has been taken out).
  let title = state.text.replace(/\s+/g, " ").trim();
  title = title.replace(/\s+(?:on|by|due|at|for|from|every|next|this|in)$/i, "").trim();
  if (!title) title = input.trim();

  return { title, priority, dueDate: dueDate ? toDateKey(dueDate) : null, recurrence, trackHint };
}

// "#cpp" or "#c++ basics" -> the track whose name starts with (or failing
// that contains) what was typed, ignoring case and punctuation.
function squash(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function matchTrack(tracks: Pick<Track, "id" | "name">[], hint: string | null): Pick<Track, "id" | "name"> | null {
  if (!hint) return null;
  const h = squash(hint);
  if (!h) return null;
  return (
    tracks.find((t) => squash(t.name) === h) ??
    tracks.find((t) => squash(t.name).startsWith(h)) ??
    tracks.find((t) => squash(t.name).includes(h)) ??
    null
  );
}
