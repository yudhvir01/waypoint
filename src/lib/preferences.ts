// Per-device conveniences. Waypoint has no settings table on any backend,
// so these live in localStorage and don't follow you to another device.

const FOCUS_MINUTES_KEY = "waypoint.focusMinutes";
const BREAK_MINUTES_KEY = "waypoint.breakMinutes";

export interface FocusSettings {
  focusMinutes: number;
  breakMinutes: number;
}

function readMinutes(key: string, fallback: number, min: number, max: number): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && localStorage.getItem(key) !== null ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  } catch {
    return fallback;
  }
}

export function getFocusSettings(): FocusSettings {
  return {
    focusMinutes: readMinutes(FOCUS_MINUTES_KEY, 25, 1, 180),
    breakMinutes: readMinutes(BREAK_MINUTES_KEY, 5, 0, 60),
  };
}

export function setFocusSettings(settings: FocusSettings): void {
  try {
    localStorage.setItem(FOCUS_MINUTES_KEY, String(settings.focusMinutes));
    localStorage.setItem(BREAK_MINUTES_KEY, String(settings.breakMinutes));
  } catch {
    // Not saved; the defaults apply next time.
  }
}
