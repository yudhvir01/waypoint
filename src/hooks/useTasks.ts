import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { CreateTaskInput, FocusTask, UpdateTaskInput, UpdateTaskScheduleInput } from "../lib/backend/types";
import type { Task, Topic } from "../lib/database.types";
import * as cache from "../lib/cache";
import { nextOccurrence } from "../lib/recurrence";
import { reviewTitle, scheduleTaskReview, toggleTaskWithFollowUps } from "../lib/taskActions";
import { useWrite } from "./useWrite";

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

// Every query a task change can show up in.
const TASK_VIEWS = ["tasks", "focusNow", "planned", "trackProgress", "topicProgress", "topics", "snapshot"];

// A task as it will look once saved, for showing before the save is done.
export function draftTask(topic: Pick<Topic, "id" | "track_id">, input: CreateTaskInput & { id: string }): Task {
  return {
    id: input.id,
    topic_id: topic.id,
    track_id: topic.track_id,
    title: input.title,
    done: false,
    priority: input.priority ?? "none",
    due_date: input.dueDate || null,
    completed_at: null,
    recurrence: input.recurrence ?? null,
    planned_on: null,
    sort_order: Number.MAX_SAFE_INTEGER,
    created_at: new Date().toISOString(),
  };
}

export function useCreateTask(topic: Pick<Topic, "id" | "track_id">) {
  return useWrite({
    run: (backend, input: CreateTaskInput) => backend.createTask(topic.id, input),
    show: (qc, input) => {
      input.id ??= crypto.randomUUID();
      cache.addTask(qc, draftTask(topic, { ...input, id: input.id }));
    },
    refresh: TASK_VIEWS,
  });
}

export function useUpdateTaskSchedule() {
  return useWrite({
    run: (backend, { taskId, ...rest }: UpdateTaskScheduleInput & { taskId: string }) =>
      backend.updateTaskSchedule(taskId, rest),
    show: (qc, { taskId, ...rest }) => {
      const patch: Partial<Task> = {};
      if (rest.dueDate !== undefined) patch.due_date = rest.dueDate;
      if (rest.recurrence !== undefined) patch.recurrence = rest.recurrence;
      cache.patchTask(qc, taskId, patch);
    },
    refresh: TASK_VIEWS,
  });
}

export function useUpdateTask() {
  return useWrite({
    run: (backend, { taskId, ...rest }: UpdateTaskInput & { taskId: string }) => backend.updateTask(taskId, rest),
    show: (qc, { taskId, title, priority, dueDate, recurrence }) =>
      cache.patchTask(qc, taskId, {
        title,
        priority,
        due_date: dueDate,
        ...(recurrence !== undefined ? { recurrence } : {}),
      }),
    refresh: TASK_VIEWS,
  });
}

export function useDeleteTask() {
  return useWrite({
    run: (backend, taskId: string) => backend.deleteTask(taskId),
    show: (qc, taskId) => cache.removeTasks(qc, (t) => t.id === taskId),
    refresh: [...TASK_VIEWS, "notes", "linkIndex"],
  });
}

// Ticks a task off, or back on, anywhere it's listed: a track page, Today
// or a task's own sheet.
// "Review this again in…": a "Review: <task>" task in the same topic, or
// the one already waiting moved to the new day.
export function useScheduleReview(task: Task) {
  return useWrite({
    run: (backend, input: { dueDate: string; id?: string }) => scheduleTaskReview(backend, task, input.dueDate, input.id),
    show: (qc, input) => {
      const title = reviewTitle(task.title);
      const waiting = cache.topicTasks(qc, task.topic_id)?.find((t) => !t.done && t.title === title);
      if (waiting) {
        cache.patchTask(qc, waiting.id, { due_date: input.dueDate });
        return;
      }
      input.id = crypto.randomUUID();
      cache.addTask(
        qc,
        draftTask(
          { id: task.topic_id, track_id: task.track_id },
          { id: input.id, title, priority: task.priority, dueDate: input.dueDate },
        ),
      );
    },
    refresh: TASK_VIEWS,
  });
}

// The id of a repeating task's next occurrence, made when it's shown so
// the saved one is the same task.
const nextIds = new WeakMap<Task, string>();

export function useToggleTask() {
  return useWrite({
    run: (backend, task: Task) => toggleTaskWithFollowUps(backend, task, nextIds.get(task)),
    show: (qc, task) => {
      cache.toggleTask(qc, task);
      // A repeating task leaves its next occurrence behind.
      if (!task.done && task.recurrence) {
        const id = crypto.randomUUID();
        nextIds.set(task, id);
        cache.addTask(
          qc,
          draftTask(
            { id: task.topic_id, track_id: task.track_id },
            {
              id,
              title: task.title,
              priority: task.priority,
              dueDate: nextOccurrence(task.due_date, task.recurrence),
              recurrence: task.recurrence,
            },
          ),
        );
      }
    },
    refresh: TASK_VIEWS,
  });
}

// Puts the tasks already on screen in a new order (a drag, or Move up /
// Move down). Only the tasks whose position actually changed are written,
// and the list shows the new order straight away rather than snapping
// back until the save comes through.
export function useReorderTasks(topicId: string) {
  // Reuse the order values the tasks already hold (so anything not loaded
  // yet stays below them), made strictly increasing in case older rows
  // share a value.
  function withOrder(ordered: Task[]): { tasks: Task[]; updates: { id: string; sort_order: number }[] } {
    const slots = ordered.map((t) => t.sort_order).sort((a, b) => a - b);
    const updates: { id: string; sort_order: number }[] = [];
    let prev = -1;
    const tasks = ordered.map((task, i) => {
      const value = Math.max(slots[i], prev + 1);
      prev = value;
      if (value !== task.sort_order) updates.push({ id: task.id, sort_order: value });
      return { ...task, sort_order: value };
    });
    return { tasks, updates };
  }

  return useWrite({
    run: (backend, ordered: Task[]) => {
      const { updates } = withOrder(ordered);
      return updates.length > 0 ? backend.reorderTasks(updates) : Promise.resolve();
    },
    show: (qc, ordered) => {
      const key = ["tasks", topicId];
      const previous = qc.getQueryData<InfiniteData<Task[]>>(key);
      if (!previous) return;
      const { tasks } = withOrder(ordered);
      const pages: Task[][] = [];
      for (let i = 0; i < tasks.length; i += TASK_PAGE_SIZE) pages.push(tasks.slice(i, i + TASK_PAGE_SIZE));
      qc.setQueryData<InfiniteData<Task[]>>(key, {
        ...previous,
        pages: pages.length ? pages : [[]],
        pageParams: previous.pageParams.slice(0, Math.max(pages.length, 1)),
      });
    },
    refresh: ["tasks", "focusNow"],
  });
}

// Used by Review to deal with a pile of overdue tasks in one action.
export function useRescheduleTasks() {
  return useWrite({
    run: (backend, { taskIds, dueDate }: { taskIds: string[]; dueDate: string | null }) =>
      backend.rescheduleTasks(taskIds, dueDate),
    show: (qc, { taskIds, dueDate }) => cache.patchTasks(qc, new Set(taskIds), { due_date: dueDate }),
    refresh: ["snapshot", "focusNow", "planned", "tasks"],
  });
}

export function useMoveTask() {
  return useWrite({
    run: (backend, { taskId, topicId }: { taskId: string; topicId: string; trackId?: string }) =>
      backend.moveTask(taskId, topicId),
    show: (qc, { taskId, topicId, trackId }) => {
      const task = cache.findTask(qc, taskId);
      cache.removeTasks(qc, (t) => t.id === taskId);
      if (task && trackId) {
        const { topic: _topic, ...plain } = task as FocusTask;
        cache.addTask(qc, { ...plain, topic_id: topicId, track_id: trackId, sort_order: Number.MAX_SAFE_INTEGER });
      }
    },
    refresh: ["tasks", "topics", "focusNow", "planned", "trackProgress", "topicProgress", "snapshot"],
  });
}
