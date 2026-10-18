import type { InfiniteData } from "@tanstack/react-query";
import type { Topic, Track } from "../lib/database.types";
import * as cache from "../lib/cache";
import { findTodoTrack, placeQuickAdd, TODO_NAME } from "../lib/inbox";
import { parseQuickAdd } from "../lib/quickAdd";
import { draftTask } from "./useTasks";
import { useWrite } from "./useWrite";

// Shows the task on the To do list and Today at once; the To do list
// itself is made, if it has to be, when the save runs.
export function useQuickAdd() {
  return useWrite({
    run: async (backend, input: { text: string; id: string }) => {
      const parsed = parseQuickAdd(input.text);
      const placed = await placeQuickAdd(backend);
      await backend.createTask(placed.topicId, {
        id: input.id,
        title: parsed.title,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        recurrence: parsed.recurrence,
      });
    },
    show: (qc, input) => {
      const track = findTodoTrack(qc.getQueryData<Track[]>(["tracks", "active"]));
      const topic = track && qc.getQueryData<InfiniteData<Topic[]>>(["topics", track.id])?.pages[0]?.[0];
      if (!track || !topic) return;
      const parsed = parseQuickAdd(input.text);
      const task = draftTask(topic, {
        id: input.id,
        title: parsed.title,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        recurrence: parsed.recurrence,
      });
      cache.addTask(qc, task);
      cache.addFocusTask(qc, {
        ...task,
        topic: { id: topic.id, title: topic.title, track: { id: track.id, name: TODO_NAME } },
      });
    },
    refresh: ["focusNow", "tasks", "trackProgress", "topicProgress", "topics", "tracks", "snapshot"],
  });
}
