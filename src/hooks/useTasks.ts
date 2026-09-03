import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Task, TaskPriority } from "../lib/database.types";

export function useTasks(topicId: string | undefined) {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["tasks", topicId],
    enabled: !!client && !!session && !!topicId,
    queryFn: async () => {
      const { data, error } = await client!
        .from("tasks")
        .select("*")
        .eq("topic_id", topicId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask(topicId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      reminderLeadDays?: number | null;
    }) => {
      const existing = queryClient.getQueryData<Task[]>(["tasks", topicId]) ?? [];
      const { data, error } = await client!
        .from("tasks")
        .insert({
          topic_id: topicId,
          title: input.title,
          priority: input.priority ?? "none",
          due_date: input.dueDate || null,
          // A reminder needs a date to count backwards from.
          reminder_lead_days: input.dueDate ? (input.reminderLeadDays ?? null) : null,
          sort_order: existing.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", topicId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    },
  });
}

export function useUpdateTaskSchedule(topicId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      dueDate?: string | null;
      reminderLeadDays?: number | null;
    }) => {
      const patch: Record<string, unknown> = {};
      if ("dueDate" in input) patch.due_date = input.dueDate || null;
      if ("reminderLeadDays" in input) patch.reminder_lead_days = input.reminderLeadDays;
      const { error } = await client!.from("tasks").update(patch).eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", topicId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
    },
  });
}

export function useUpdateTask(topicId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      title: string;
      priority: TaskPriority;
      dueDate: string | null;
      reminderLeadDays: number | null;
    }) => {
      const { error } = await client!
        .from("tasks")
        .update({
          title: input.title,
          priority: input.priority,
          due_date: input.dueDate,
          reminder_lead_days: input.dueDate ? input.reminderLeadDays : null,
        })
        .eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", topicId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
    },
  });
}

export function useDeleteTask(topicId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await client!.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", topicId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    },
  });
}

export function useToggleTask(topicId: string) {
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
      queryClient.invalidateQueries({ queryKey: ["tasks", topicId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    },
  });
}
