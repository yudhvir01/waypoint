import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useBackend } from "./BackendProvider";
import {
  IDLE,
  endsAt,
  finishFocus,
  focusedMinutes,
  isFinished,
  isPaused,
  parseStored,
  pause as pauseState,
  remainingMs,
  resume as resumeState,
  startBreak as startBreakState,
  startFocus,
  toIdle,
  type TimerState,
} from "../lib/focusTimer";
import { getFocusSettings } from "../lib/preferences";
import {
  cancelPhaseNotification,
  requestTimerNotificationPermission,
  schedulePhaseNotification,
} from "../lib/timerNotifications";

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
  // A finished block waits for the person: this starts the break.
  startBreak: () => void;
}

const FocusTimerContext = createContext<FocusTimerApi | null>(null);

// While the page is alive but not in front (another tab, a minimised
// window), a web notification that stays until it is clicked. When the app
// is in front the in-app prompt does this job, and a short vibration is
// enough. There is deliberately no beep: it is easy to miss and easy to
// find annoying.
function alertPhaseEnd(title: string, body: string) {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not available.
  }
  if (!document.hidden || Capacitor.isNativePlatform()) return;
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body, tag: "waypoint-focus", requireInteraction: true });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    // Some webviews throw on `new Notification`.
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
  // The installed app asks the operating system to deliver the "block is
  // over" notification only while it isn't in front: in front, the prompt
  // on screen is the notification.
  const [appActive, setAppActive] = useState(true);
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
        alertPhaseEnd(
          "Focus block done",
          s.breakMinutes > 0 ? `Tap to start your ${s.breakMinutes}-minute break.` : "Nice work.",
        );
        // Wait here. Whoever set the phone down needs to see this before
        // a break they didn't ask for starts and ends unnoticed.
        setState(finishFocus(s, t));
      } else {
        alertPhaseEnd("Break over", "Ready for the next block?");
        setState(toIdle(s));
      }
    },
    [log],
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => Promise<void>) | undefined;
    let cancelled = false;
    void CapacitorApp.addListener("appStateChange", (s) => setAppActive(s.isActive)).then((h) => {
      if (cancelled) void h.remove();
      else remove = () => h.remove();
    });
    return () => {
      cancelled = true;
      void remove?.();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const at = endsAt(state, Date.now());
    if (appActive || at === null) {
      void cancelPhaseNotification();
      return;
    }
    const isFocus = state.phase === "focus";
    void schedulePhaseNotification({
      at,
      title: isFocus ? "Focus block done" : "Break over",
      body: isFocus
        ? `${state.taskTitle ? `${state.taskTitle} · ` : ""}${
            state.breakMinutes > 0 ? `Tap to start your ${state.breakMinutes}-minute break.` : "Nice work."
          }`
        : "Ready for the next block?",
    });
  }, [state, appActive]);

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
    document.title =
      state.phase === "focus-done"
        ? "✓ Focus done · Waypoint"
        : `${clock} ${state.phase === "focus" ? "Focus" : "Break"} · Waypoint`;
  }, [state, now]);

  const start = useCallback(
    (task: { id: string; title: string } | null) => {
      const t = Date.now();
      // Switching task mid-block keeps what was done on the old one.
      if (state.phase === "focus") void log(state, focusedMinutes(state, t));
      const settings = getFocusSettings();
      void requestTimerNotificationPermission();
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
        setState(toIdle(state));
      },
      startBreak: () => {
        const t = Date.now();
        setNow(t);
        setState((s) => (s.phase === "focus-done" ? startBreakState(s, t) : s));
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
