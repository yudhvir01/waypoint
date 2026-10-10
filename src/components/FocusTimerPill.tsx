import { useEffect, useRef, useState } from "react";
import { useFocusTimer } from "../context/FocusTimerProvider";
import { breakStillOffered, formatClock } from "../lib/focusTimer";

function ago(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

// A finished block waits here until the person says what's next. Nothing
// starts by itself: the phone may be on the desk across the room.
function FocusDoneDialog() {
  const { state, startBreak, stop } = useFocusTimer();
  const primary = useRef<HTMLButtonElement>(null);
  // Read once, when the prompt appears.
  const [shownAt] = useState(() => Date.now());
  const offered = breakStillOffered(state, shownAt);

  useEffect(() => {
    primary.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="focus-done-title"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-xl text-success">
          ✓
        </div>
        <h2 id="focus-done-title" className="mt-3 text-lg font-semibold">
          Focus block done
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.focusMinutes} minutes
          {state.taskTitle ? ` on “${state.taskTitle}”` : ""} logged
          {state.finishedAt ? ` · ${ago(shownAt - state.finishedAt)}` : ""}.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {offered ? (
            <>
              <button
                ref={primary}
                type="button"
                onClick={startBreak}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Start {state.breakMinutes}-minute break
              </button>
              <button
                type="button"
                onClick={stop}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Skip the break
              </button>
            </>
          ) : (
            <button
              ref={primary}
              type="button"
              onClick={stop}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The running timer, fixed to the corner of every page.
export function FocusTimerPill() {
  const { state, remaining, paused, pause, resume, stop } = useFocusTimer();
  if (state.phase === "idle") return null;
  if (state.phase === "focus-done") return <FocusDoneDialog />;

  const focus = state.phase === "focus";
  const btn =
    "rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent text-muted-foreground hover:text-foreground";

  return (
    <div
      className="fixed z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg"
      style={{
        right: "calc(1rem + env(safe-area-inset-right))",
        bottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
      role="timer"
      aria-label={focus ? "Focus timer" : "Break timer"}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${focus ? "bg-primary" : "bg-success"} ${paused ? "opacity-40" : ""}`} />
      <span className="font-mono text-sm tabular-nums">{formatClock(remaining)}</span>
      <span className="min-w-0 max-w-[10rem] truncate text-xs text-muted-foreground">
        {focus ? (paused ? "Paused" : (state.taskTitle ?? "Focus")) : "Break"}
      </span>
      <div className="flex items-center">
        {paused ? (
          <button type="button" onClick={resume} className={btn}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={pause} className={btn}>
            Pause
          </button>
        )}
        <button type="button" onClick={stop} className={btn}>
          {focus ? "Stop" : "Skip"}
        </button>
      </div>
    </div>
  );
}
