import { useFocusTimer } from "../context/FocusTimerProvider";
import { formatClock } from "../lib/focusTimer";

// The running timer, fixed to the corner of every page.
export function FocusTimerPill() {
  const { state, remaining, paused, pause, resume, stop } = useFocusTimer();
  if (state.phase === "idle") return null;

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
