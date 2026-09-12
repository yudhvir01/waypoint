import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { FocusTask } from "../lib/backend/types";
import type { Task } from "../lib/database.types";

export type { FocusTask };

// The dashboard renders at most eight rows. Asking for a few more than
// that leaves room for the "Today" / "Up next" split without ever pulling
// a meaningful fraction of the table.
const FOCUS_LIMIT = 40;

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

export function useToggleFocusTask() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const focusKey = ["focusNow"];

  return useMutation({
    mutationFn: (task: Task) => backend!.toggleTask(task),
    // Ticking something off the dashboard should make it disappear at
    // once rather than after a round trip.
    onMutate: async (task: Task) => {
      await queryClient.cancelQueries({ queryKey: focusKey });
      const previous = queryClient.getQueryData<FocusTask[]>(focusKey);
      queryClient.setQueryData<FocusTask[]>(focusKey, (old) => old?.filter((t) => t.id !== task.id));
      return { previous };
    },
    onError: (_err, _task, context) => {
      if (context?.previous) queryClient.setQueryData(focusKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
      queryClient.invalidateQueries({ queryKey: ["topicProgress"] });
    },
  });
}
