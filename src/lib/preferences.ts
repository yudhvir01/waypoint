// Per-device conveniences. Waypoint has no settings table on any backend,
// so these live in localStorage and don't follow you to another device.

const SPACED_REVISIT_KEY = "waypoint.spacedRevisit";

// On by default: finishing a topic quietly schedules a few review tasks.
export function getSpacedRevisit(): boolean {
  try {
    return localStorage.getItem(SPACED_REVISIT_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSpacedRevisit(enabled: boolean): void {
  try {
    localStorage.setItem(SPACED_REVISIT_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode / storage blocked: the preference just doesn't stick.
  }
}
