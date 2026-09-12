import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Task, TaskPriority } from "../lib/database.types";

// A topic can hold an unbounded number of tasks, so they arrive a page at
// a time. PostgREST caps responses at 1000 rows regardless, so an
// unpaginated select doesn't just get slow past that point — it silently
// stops returning the rest.
export const TASK_PAGE_SIZE = 200;

export function useTasks(topicId: string | undefined, enabled = true) {
  const { client, session } = useSupabase();

  return useInfiniteQuery({
    queryKey: ["tasks", topicId],
    enabled: enabled && !!client && !!session && !!topicId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: Task[], allPages: Task[][]) =>
      lastPage.length < TASK_PAGE_SIZE ? undefined : allPages.length,
    queryFn: async ({ pageParam }): Promise<Task[]> => {
      const from = (pageParam as number) * TASK_PAGE_SIZE;
      const { data, error } = await client!
        .from("tasks")
        .select("*")
        .eq("topic_id", topicId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + TASK_PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

// Every task mutation touches the same four caches: the topic's own task
// list, the dashboard, and the two progress aggregates.
function useTaskInvalidator(topicId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", topicId] });
    queryClient.invalidateQueries({ queryKey: ["focusNow"] });
    queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    queryClient.invalidateQueries({ queryKey: ["topicProgress"] });
  };
}

export function useCreateTask(topicId: string) {
  const { client } = useSupabase();
  const invalidate = useTaskInvalidator(topicId);

  return useMutation({
    mutationFn: async (input: {
      title: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      reminderLeadDays?: number | null;
    }) => {
      const { data, error } = await client!
        .from("tasks")
        .insert({
          topic_id: topicId,
          title: input.title,
          priority: input.priority ?? "none",
          due_date: input.dueDate || null,
          // A reminder needs a date to count backwards from.
          reminder_lead_days: input.dueDate ? (input.reminderLeadDays ?? null) : null,
          // sort_order is left to the database, which appends to the end
          // of the topic. Deriving it from the currently cached page put
          // new tasks on top of existing ones as soon as the list was
          // paginated or another device had added one.
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTaskSchedule(topicId: string) {
  const { client } = useSupabase();
  const invalidate = useTaskInvalidator(topicId);

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
    onSuccess: invalidate,
  });
}

export function useUpdateTask(topicId: string) {
  const { client } = useSupabase();
  const invalidate = useTaskInvalidator(topicId);

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
    onSuccess: invalidate,
  });
}

export function useDeleteTask(topicId: string) {
  const { client } = useSupabase();
  const invalidate = useTaskInvalidator(topicId);

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await client!.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useToggleTask(topicId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();
  const invalidate = useTaskInvalidator(topicId);
  const key = ["tasks", topicId];

  return useMutation({
    // completed_at is stamped by the database from `done`, so the two can
    // never disagree.
    mutationFn: async (task: Task) => {
      const { error } = await client!
        .from("tasks")
        .update({ done: !task.done })
        .eq("id", task.id);
      if (error) throw error;
    },
    onMutate: async (task: Task) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<InfiniteData<Task[]>>(key);
      queryClient.setQueryData<InfiniteData<Task[]>>(key, (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) =>
            page.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
          ),
        },
      );
      return { previous };
    },
    onError: (_err, _task, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: invalidate,
  });
}
