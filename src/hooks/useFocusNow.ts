import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Task } from "../lib/database.types";

export interface FocusTask extends Task {
  topic: {
    id: string;
    title: string;
    track: {
      id: string;
      name: string;
    };
  };
}

// The dashboard renders at most eight rows. Asking for a few more than
// that leaves room for the "Today" / "Up next" split without ever pulling
// a meaningful fraction of the table.
const FOCUS_LIMIT = 40;

interface FocusRow {
  id: string;
  topic_id: string;
  title: string;
  done: boolean;
  priority: Task["priority"];
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  reminder_lead_days: number | null;
  created_at: string;
  topic_title: string;
  track_id: string;
  track_name: string;
}

// Urgency ranking happens in Postgres (see focus_tasks in setup.sql), so
// this returns the handful of rows that actually get rendered. Ranking it
// client-side meant downloading every open task the user had — and
// PostgREST caps responses at 1000 rows, so past that the "most urgent"
// list was ranked over an arbitrary subset.
export function useFocusNow() {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["focusNow", session?.user.id],
    enabled: !!client && !!session,
    queryFn: async (): Promise<FocusTask[]> => {
      const { data, error } = await client!.rpc("focus_tasks", { p_limit: FOCUS_LIMIT });
      if (error) throw error;

      return ((data ?? []) as FocusRow[]).map((row) => ({
        id: row.id,
        topic_id: row.topic_id,
        track_id: row.track_id,
        title: row.title,
        done: row.done,
        priority: row.priority,
        due_date: row.due_date,
        completed_at: row.completed_at,
        sort_order: row.sort_order,
        reminder_lead_days: row.reminder_lead_days,
        created_at: row.created_at,
        topic: {
          id: row.topic_id,
          title: row.topic_title,
          track: { id: row.track_id, name: row.track_name },
        },
      }));
    },
  });
}

export function useToggleFocusTask() {
  const { client, session } = useSupabase();
  const queryClient = useQueryClient();
  const focusKey = ["focusNow", session?.user.id];

  return useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await client!
        .from("tasks")
        .update({ done: !task.done })
        .eq("id", task.id);
      if (error) throw error;
    },
    // Ticking something off the dashboard should make it disappear at
    // once rather than after a round trip.
    onMutate: async (task: Task) => {
      await queryClient.cancelQueries({ queryKey: focusKey });
      const previous = queryClient.getQueryData<FocusTask[]>(focusKey);
      queryClient.setQueryData<FocusTask[]>(focusKey, (old) =>
        old?.filter((t) => t.id !== task.id),
      );
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
