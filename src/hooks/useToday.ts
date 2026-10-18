import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { FocusTask } from "../lib/backend/types";
import * as cache from "../lib/cache";
import { toDateKey } from "../lib/recurrence";
import { useWrite } from "./useWrite";

// A day is opened by picking at most this many tasks. Few enough that
// finishing them is likely, which is the point.
export const MAX_PICKS = 3;

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

export function yesterdayKey(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

// Today's picks plus yesterday's, so what didn't get done can be carried
// over rather than silently dropped.
export function usePlannedTasks() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["planned", yesterdayKey()],
    enabled: !!backend,
    // An older Supabase project without tasks.planned_on fails; once is
    // enough to know.
    retry: false,
    queryFn: (): Promise<FocusTask[]> => backend!.listPlannedTasks(yesterdayKey()),
  });
}

export function usePlanTasks() {
  return useWrite({
    run: (backend, { taskIds, day }: { taskIds: string[]; day: string | null }) => backend.planTasks(taskIds, day),
    show: (qc, { taskIds, day }) => {
      const ids = new Set(taskIds);
      cache.patchTasks(qc, ids, { planned_on: day });
      qc.setQueriesData<FocusTask[]>({ queryKey: ["planned"] }, (old) => {
        if (!old) return old;
        const kept = old.filter((t) => !ids.has(t.id));
        if (!day) return kept;
        // Picked tasks come from Today, which knows where each one lives.
        const today = qc.getQueryData<FocusTask[]>(["focusNow"]) ?? [];
        const picked = today.filter((t) => ids.has(t.id)).map((t) => ({ ...t, planned_on: day }));
        return [...kept, ...picked];
      });
    },
    refresh: ["planned", "tasks", "focusNow"],
  });
}
