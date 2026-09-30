import type { Task, Topic, TopicStatus, Track } from "../database.types";
import type { FocusTask, TrackProgress } from "./types";

// Shared by every backend that keeps its whole dataset in memory (guest,
// Drive) rather than querying a database — the ranking rules mirror
// focus_tasks() in setup.sql exactly, so "what needs my attention"
// doesn't quietly differ depending on where your data happens to live.

function daysUntil(dueDate: string, today: Date): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function focusTier(task: Task, today: Date): number {
  if (task.due_date) {
    const delta = daysUntil(task.due_date, today);
    if (delta < 0) return 0;
    if (delta <= 2) return 1;
  }
  if (task.priority === "high") return 2;
  if (task.priority === "medium") return 3;
  return 4;
}

export function rankFocusTasks(tracks: Track[], topics: Topic[], tasks: Task[], limit: number): FocusTask[] {
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const open = tasks.filter((t) => !t.done && trackById.get(t.track_id)?.status === "active");
  const ranked = open
    .sort((a, b) => {
      const diff = focusTier(a, today) - focusTier(b, today);
      if (diff !== 0) return diff;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      // Nothing to separate them by deadline or priority: what you are
      // in the middle of comes first, in roadmap order.
      const ta = topicById.get(a.topic_id);
      const tb = topicById.get(b.topic_id);
      const activeDiff = Number(tb?.status === "in_progress") - Number(ta?.status === "in_progress");
      if (activeDiff !== 0) return activeDiff;
      if (ta && tb && ta.id !== tb.id) {
        const orderDiff = ta.sort_order - tb.sort_order;
        if (orderDiff !== 0) return orderDiff;
      }
      return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
    })
    .slice(0, limit);

  return ranked.map((task) => {
    const topic = topicById.get(task.topic_id)!;
    const track = trackById.get(task.track_id)!;
    return {
      ...task,
      topic: { id: topic.id, title: topic.title, track: { id: track.id, name: track.name } },
    };
  });
}

export function computeTrackProgress(tasks: Task[]): Map<string, TrackProgress> {
  const map = new Map<string, TrackProgress>();
  for (const task of tasks) {
    const entry = map.get(task.track_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (task.done) entry.done += 1;
    map.set(task.track_id, entry);
  }
  return map;
}

export function computeTopicProgress(tasks: Task[], trackId: string): Map<string, TrackProgress> {
  const map = new Map<string, TrackProgress>();
  for (const task of tasks) {
    if (task.track_id !== trackId) continue;
    const entry = map.get(task.topic_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (task.done) entry.done += 1;
    map.set(task.topic_id, entry);
  }
  return map;
}

// Topic statuses follow the tasks: ticking a task starts its topic,
// finishing the last one completes it, and completing a topic starts the
// next not-yet-started one in the track. `topics` is every topic in the
// track; `tasks` is the changed topic's tasks. Returns only real changes.
export function topicStatusChanges(
  topics: Topic[],
  tasks: Pick<Task, "done">[],
  topicId: string,
): { id: string; status: TopicStatus }[] {
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return [];
  const done = tasks.filter((t) => t.done).length;

  let status: TopicStatus = topic.status;
  if (tasks.length > 0 && done === tasks.length) status = "done";
  else if (done > 0) status = "in_progress";
  else if (topic.status === "done") status = "not_started";

  const changes: { id: string; status: TopicStatus }[] = [];
  if (status !== topic.status) changes.push({ id: topic.id, status });

  if (status === "done" && topic.status !== "done") {
    const ordered = [...topics].sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    const next = ordered
      .slice(ordered.findIndex((t) => t.id === topic.id) + 1)
      .find((t) => t.status === "not_started");
    if (next) changes.push({ id: next.id, status: "in_progress" });
  }
  return changes;
}
