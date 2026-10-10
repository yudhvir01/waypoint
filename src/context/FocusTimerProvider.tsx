import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBackend } from "./BackendProvider";
import {
  IDLE,
  focusedMinutes,
  isFinished,
  isPaused,
  parseStored,
  pause as pauseState,
  remainingMs,
  resume as resumeState,
  startBreak,
  startFocus,
  type TimerState,
} from "../lib/focusTimer";
import { getFocusSettings } from "../lib/preferences";

const STORAGE_KEY = "waypoint.focusTimer";

export interface FocusTimerApi {
  state: TimerState;
  remaining: number;
  paused: boolean;
  start: (task: { id: string; title: string } | null) => void;
  pause: () => void;
  resume: () => void;
  // Ends a focus block early (logging what was done) or skips a break.
  stop: () => void;
}

const FocusTimerContext = createContext<FocusTimerApi | null>(null);

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    // No audio available; the notification and title still say so.
  }
}

function notify(title: string, body: string) {
  beep();
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // Some mobile webviews throw on `new Notification`.
  }
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TimerState>(() => {
    try {
      return parseStored(localStorage.getItem(STORAGE_KEY));
    } catch {
      return IDLE;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  // A focus block is logged once, even if the tick fires again before the
  // state change lands.
  const logged = useRef(new Set<string>());
  // Phase ends already acted on, so a late tick can't repeat them.
  const handled = useRef(new Set<string>());
  const baseTitle = useRef<string | null>(null);

  const log = useCallback(
    async (s: TimerState, minutes: number) => {
      if (!backend || minutes < 1 || !s.sessionStartedAt) return;
      if (logged.current.has(s.sessionStartedAt)) return;
      logged.current.add(s.sessionStartedAt);
      try {
        await backend.logFocusSession({ taskId: s.taskId, startedAt: s.sessionStartedAt, minutes });
        queryClient.invalidateQueries({ queryKey: ["focusSessions"] });
        queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      } catch {
        // Let a later attempt (stopping again) try once more.
        logged.current.delete(s.sessionStartedAt);
      }
    },
    [backend, queryClient],
  );

  useEffect(() => {
    try {
      if (state.phase === "idle") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Without storage a reload just forgets the running timer.
    }
  }, [state]);

  // What happens when a phase runs out: a focus block is logged and a
  // break begins; a break just ends.
  const finish = useCallback(
    (s: TimerState, t: number) => {
      const key = `${s.phase}:${s.sessionStartedAt ?? s.segmentStart}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      if (s.phase === "focus") {
        void log(s, Math.max(1, Math.round(s.durationMs / 60_000)));
        notify("Focus block done", s.breakMinutes > 0 ? `Take ${s.breakMinutes} minutes.` : "Nice work.");
        setState(startBreak(s, t));
      } else {
        notify("Break over", "Ready for another block?");
        setState({ ...IDLE, focusMinutes: s.focusMinutes, breakMinutes: s.breakMinutes });
      }
    },
    [log],
  );

  // One tick drives both the clock and the end of a phase. It also catches
  // a timer that ran out while the tab was closed, on its first tick.
  const running = state.phase !== "idle" && state.segmentStart !== null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      if (isFinished(state, t)) finish(state, t);
      else setNow(t);
    }, 500);
    return () => window.clearInterval(id);
  }, [running, state, finish]);

  // The tab title shows the clock, so it's visible from another tab.
  useEffect(() => {
    if (state.phase === "idle") {
      if (baseTitle.current !== null) {
        document.title = baseTitle.current;
        baseTitle.current = null;
      }
      return;
    }
    if (baseTitle.current === null) baseTitle.current = document.title;
    const left = Math.ceil(remainingMs(state, now) / 1000);
    const clock = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    document.title = `${clock} ${state.phase === "focus" ? "Focus" : "Break"} · Waypoint`;
  }, [state, now]);

  const start = useCallback(
    (task: { id: string; title: string } | null) => {
      const t = Date.now();
      // Switching task mid-block keeps what was done on the old one.
      if (state.phase === "focus") void log(state, focusedMinutes(state, t));
      const settings = getFocusSettings();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch {
        // Not available here.
      }
      setNow(t);
      setState(
        startFocus(
          { taskId: task?.id ?? null, taskTitle: task?.title ?? null, ...settings },
          t,
        ),
      );
    },
    [state, log],
  );

  const api = useMemo<FocusTimerApi>(
    () => ({
      state,
      remaining: remainingMs(state, now),
      paused: isPaused(state),
      start,
      pause: () => setState((s) => pauseState(s, Date.now())),
      resume: () => {
        setNow(Date.now());
        setState((s) => resumeState(s, Date.now()));
      },
      stop: () => {
        const t = Date.now();
        if (state.phase === "focus") void log(state, focusedMinutes(state, t));
        setState({ ...IDLE, focusMinutes: state.focusMinutes, breakMinutes: state.breakMinutes });
      },
    }),
    [state, now, start, log],
  );

  return <FocusTimerContext.Provider value={api}>{children}</FocusTimerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFocusTimer(): FocusTimerApi {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used inside FocusTimerProvider");
  return ctx;
}
