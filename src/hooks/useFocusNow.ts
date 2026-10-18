import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { FocusTask } from "../lib/backend/types";

export type { FocusTask };

// Today suggests six, at most two per track, and lists the rest under
// "More from your tracks". Asking for well over six leaves room for a
// track with many urgent tasks without hiding the other tracks behind it.
const FOCUS_LIMIT = 100;

// Urgency ranking happens in the backend (Postgres on Supabase, an
// in-memory sort on guest) so this only ever handles the handful of rows
// that actually get rendered.
export function useFocusNow() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["focusNow"],
    enabled: !!backend,
    queryFn: (): Promise<FocusTask[]> => backend!.focusTasks(FOCUS_LIMIT),
  });
}
