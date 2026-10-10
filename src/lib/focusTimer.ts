// The focus timer as plain data and pure functions, so what it does at the
// edges (a pause, a closed tab, a stop after 40 seconds) can be tested.
//
// Time is kept as timestamps, not a counter that ticks: a browser slows
// background tabs' timers right down, and a counter would drift or stall.

// "focus-done" is a finished focus block waiting for the person: the break
// does not start by itself, because they may have put the phone down and
// walked away. It starts when they say so.
export type Phase = "idle" | "focus" | "focus-done" | "break";

export interface TimerState {
  phase: Phase;
  taskId: string | null;
  taskTitle: string | null;
  // When the focus block began, for the log.
  sessionStartedAt: string | null;
  durationMs: number;
  // Time already used in earlier stretches (before a pause).
  accumulatedMs: number;
  // Start of the current running stretch; null while paused.
  segmentStart: number | null;
  // Lengths chosen when it started, so changing settings mid-block can't
  // alter it.
  focusMinutes: number;
  breakMinutes: number;
  // When a focus block ended, while it waits for the person to start the
  // break (ms since epoch).
  finishedAt: number | null;
}

export const IDLE: TimerState = {
  phase: "idle",
  taskId: null,
  taskTitle: null,
  sessionStartedAt: null,
  durationMs: 0,
  accumulatedMs: 0,
  segmentStart: null,
  focusMinutes: 25,
  breakMinutes: 5,
  finishedAt: null,
};

// A break offered long after the block ended is just noise.
export const BREAK_OFFER_WINDOW_MS = 30 * 60_000;

const MINUTE = 60_000;

export function startFocus(
  args: { taskId: string | null; taskTitle: string | null; focusMinutes: number; breakMinutes: number },
  now: number,
): TimerState {
  return {
    phase: "focus",
    taskId: args.taskId,
    taskTitle: args.taskTitle,
    sessionStartedAt: new Date(now).toISOString(),
    durationMs: args.focusMinutes * MINUTE,
    accumulatedMs: 0,
    segmentStart: now,
    focusMinutes: args.focusMinutes,
    breakMinutes: args.breakMinutes,
    finishedAt: null,
  };
}

export function elapsedMs(s: TimerState, now: number): number {
  return s.accumulatedMs + (s.segmentStart === null ? 0 : Math.max(0, now - s.segmentStart));
}

export function remainingMs(s: TimerState, now: number): number {
  return Math.max(0, s.durationMs - elapsedMs(s, now));
}

export function isPaused(s: TimerState): boolean {
  return (s.phase === "focus" || s.phase === "break") && s.segmentStart === null;
}

// A block that has run out. It stops there, logged, and waits.
export function finishFocus(s: TimerState, now: number): TimerState {
  if (s.breakMinutes <= 0) return { ...IDLE, focusMinutes: s.focusMinutes, breakMinutes: s.breakMinutes };
  return {
    ...s,
    phase: "focus-done",
    accumulatedMs: s.durationMs,
    segmentStart: null,
    finishedAt: now,
  };
}

export function breakStillOffered(s: TimerState, now: number): boolean {
  return s.phase === "focus-done" && s.finishedAt !== null && now - s.finishedAt <= BREAK_OFFER_WINDOW_MS;
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.phase === "idle" || s.segmentStart === null) return s;
  return { ...s, accumulatedMs: elapsedMs(s, now), segmentStart: null };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.phase === "idle" || s.segmentStart !== null) return s;
  return { ...s, segmentStart: now };
}

// Whole minutes actually focused so far — what stopping early logs.
export function focusedMinutes(s: TimerState, now: number): number {
  if (s.phase !== "focus") return 0;
  return Math.floor(Math.min(elapsedMs(s, now), s.durationMs) / MINUTE);
}

export function startBreak(s: TimerState, now: number): TimerState {
  if (s.breakMinutes <= 0) return { ...IDLE, focusMinutes: s.focusMinutes, breakMinutes: s.breakMinutes };
  return {
    ...s,
    phase: "break",
    sessionStartedAt: null,
    durationMs: s.breakMinutes * MINUTE,
    accumulatedMs: 0,
    segmentStart: now,
    finishedAt: null,
  };
}

// Back to nothing, keeping the chosen lengths.
export function toIdle(s: TimerState): TimerState {
  return { ...IDLE, focusMinutes: s.focusMinutes, breakMinutes: s.breakMinutes };
}

// The moment the current running phase ends, for scheduling a notification.
export function endsAt(s: TimerState, now: number): number | null {
  if ((s.phase !== "focus" && s.phase !== "break") || s.segmentStart === null) return null;
  return now + remainingMs(s, now);
}

// Has the running phase reached its end?
export function isFinished(s: TimerState, now: number): boolean {
  return s.phase !== "idle" && s.segmentStart !== null && remainingMs(s, now) <= 0;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// localStorage is user-editable and may come from an older version.
export function parseStored(raw: string | null): TimerState {
  if (!raw) return IDLE;
  try {
    const o = JSON.parse(raw) as Partial<TimerState> | null;
    if (!o || (o.phase !== "focus" && o.phase !== "break" && o.phase !== "focus-done")) return IDLE;
    const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
    return {
      phase: o.phase,
      taskId: typeof o.taskId === "string" ? o.taskId : null,
      taskTitle: typeof o.taskTitle === "string" ? o.taskTitle : null,
      sessionStartedAt: typeof o.sessionStartedAt === "string" ? o.sessionStartedAt : null,
      durationMs: Math.max(0, num(o.durationMs, 0)),
      accumulatedMs: Math.max(0, num(o.accumulatedMs, 0)),
      segmentStart: o.segmentStart === null ? null : num(o.segmentStart, Date.now()),
      focusMinutes: Math.min(180, Math.max(1, num(o.focusMinutes, 25))),
      breakMinutes: Math.min(60, Math.max(0, num(o.breakMinutes, 5))),
      finishedAt: typeof o.finishedAt === "number" && Number.isFinite(o.finishedAt) ? o.finishedAt : null,
    };
  } catch {
    return IDLE;
  }
}
