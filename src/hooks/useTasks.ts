import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { CreateTaskInput, UpdateTaskInput, UpdateTaskScheduleInput } from "../lib/backend/types";
import type { Task } from "../lib/database.types";

// A topic can hold an unbounded number of tasks, so they arrive a page at
// a time. PostgREST caps responses at 1000 rows regardless, so an
// unpaginated select doesn't just get slow past that point — it silently
// stops returning the rest.
export const TASK_PAGE_SIZE = 200;

export function useTasks(topicId: string | undefined, enabled = true) {
  const { backend } = useBackend();

  return useInfiniteQuery({
    queryKey: ["tasks", topicId],
    enabled: enabled && !!backend && !!topicId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: Task[], allPages: Task[][]) =>
      lastPage.length < TASK_PAGE_SIZE ? undefined : allPages.length,
    queryFn: ({ pageParam }) => backend!.listTasks(topicId!, pageParam as number, TASK_PAGE_SIZE),
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
  const { backend } = useBackend();
  const invalidate = useTaskInvalidator(topicId);

  return useMutation({
    mutationFn: (input: CreateTaskInput) => backend!.createTask(topicId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskSchedule(topicId: string) {
  const { backend } = useBackend();
  const invalidate = useTaskInvalidator(topicId);

  return useMutation({
    mutationFn: (input: UpdateTaskScheduleInput & { taskId: string }) => {
      const { taskId, ...rest } = input;
      return backend!.updateTaskSchedule(taskId, rest);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTask(topicId: string) {
  const { backend } = useBackend();
  const invalidate = useTaskInvalidator(topicId);

  return useMutation({
    mutationFn: (input: UpdateTaskInput & { taskId: string }) => {
      const { taskId, ...rest } = input;
      return backend!.updateTask(taskId, rest);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTask(topicId: string) {
  const { backend } = useBackend();
  const invalidate = useTaskInvalidator(topicId);

  return useMutation({
    mutationFn: (taskId: string) => backend!.deleteTask(taskId),
    onSuccess: invalidate,
  });
}

export function useToggleTask(topicId: string) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const invalidate = useTaskInvalidator(topicId);
  const key = ["tasks", topicId];

  return useMutation({
    mutationFn: (task: Task) => backend!.toggleTask(task),
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
