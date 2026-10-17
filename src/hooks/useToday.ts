import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { FocusTask } from "../lib/backend/types";
import { toDateKey } from "../lib/recurrence";

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
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskIds, day }: { taskIds: string[]; day: string | null }) => backend!.planTasks(taskIds, day),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planned"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
