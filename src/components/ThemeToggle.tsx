import { useRef } from "react";
import { flushSync } from "react-dom";
import { useTheme, type ThemeMode } from "../context/ThemeProvider";

const OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "system", label: "System", icon: "◐" },
  { mode: "light", label: "Light", icon: "☀" },
  { mode: "dark", label: "Dark", icon: "☽" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  // Guards against a second click starting a new view transition while one
  // is still in flight, which throws InvalidStateError.
  const transitioning = useRef(false);

  function select(next: ThemeMode, event: React.MouseEvent<HTMLButtonElement>) {
    if (next === mode || transitioning.current) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!document.startViewTransition || reduceMotion) {
      setMode(next);
      return;
    }

    const { clientX: x, clientY: y } = event;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    transitioning.current = true;
    // flushSync forces the state update (and the layout effect that flips
    // the `.dark` class) to complete synchronously inside this callback, so
    // the browser captures the correct "after" snapshot for the transition.
    const transition = document.startViewTransition(() => {
      flushSync(() => setMode(next));
    });

    transition.finished
      .catch(() => {
        // Rejects if the browser aborts mid-flight (e.g. tab loses focus).
      })
      .finally(() => {
        transitioning.current = false;
      });

    transition.ready
      .then(() =>
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 550,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          },
        ).finished,
      )
      .catch(() => {
        // Theme is already applied by this point either way — nothing to
        // recover if the animation itself gets interrupted.
      });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted p-0.5 text-xs"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          role="radio"
          aria-checked={mode === opt.mode}
          title={opt.label}
          onClick={(e) => select(opt.mode, e)}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            mode === opt.mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span aria-hidden="true">{opt.icon}</span>
          <span className="sr-only">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
