import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

function daysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

// Lower score = more urgent. Overdue first, then due soon, then high
// priority, then everything else — each tier ordered by due date.
function focusScore(task: FocusTask): number {
  if (task.due_date) {
    const delta = daysUntil(task.due_date);
    if (delta < 0) return 0;
    if (delta <= 2) return 1;
  }
  if (task.priority === "high") return 2;
  if (task.priority === "medium") return 3;
  return 4;
}

export function useFocusNow() {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["focusNow", session?.user.id],
    enabled: !!client && !!session,
    queryFn: async () => {
      const { data, error } = await client!
        .from("tasks")
        .select("*, topic:topics(id, title, track:tracks(id, name))")
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;

      const tasks = data as unknown as FocusTask[];
      return [...tasks].sort((a, b) => {
        const scoreDiff = focusScore(a) - focusScore(b);
        if (scoreDiff !== 0) return scoreDiff;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return a.created_at.localeCompare(b.created_at);
      });
    },
  });
}

export function useToggleFocusTask() {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      const done = !task.done;
      const { error } = await client!
        .from("tasks")
        .update({ done, completed_at: done ? new Date().toISOString() : null })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
