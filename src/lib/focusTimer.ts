// The focus timer as plain data and pure functions, so what it does at the
// edges (a pause, a closed tab, a stop after 40 seconds) can be tested.
//
// Time is kept as timestamps, not a counter that ticks: a browser slows
// background tabs' timers right down, and a counter would drift or stall.

export type Phase = "idle" | "focus" | "break";

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
};

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
  };
}

export function elapsedMs(s: TimerState, now: number): number {
  return s.accumulatedMs + (s.segmentStart === null ? 0 : Math.max(0, now - s.segmentStart));
}

export function remainingMs(s: TimerState, now: number): number {
  return Math.max(0, s.durationMs - elapsedMs(s, now));
}

export function isPaused(s: TimerState): boolean {
  return s.phase !== "idle" && s.segmentStart === null;
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
  };
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
    if (!o || (o.phase !== "focus" && o.phase !== "break")) return IDLE;
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
    };
  } catch {
    return IDLE;
  }
}
