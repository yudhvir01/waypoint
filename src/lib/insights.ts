import type { Snapshot } from "./backend/types";
import type { Task, Topic, Track } from "./database.types";
import { fromDateKey, toDateKey } from "./recurrence";

const DAY_MS = 86_400_000;
export const STALE_AFTER_DAYS = 14;
export const HEATMAP_WEEKS = 26;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

export interface HeatCell {
  key: string;
  count: number;
  // 0 (none) … 4 (busiest), relative to the busiest day shown.
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export interface TaskWithPlace {
  task: Task;
  topic: Topic | undefined;
  track: Track | undefined;
}

export interface StaleTopic {
  topic: Topic;
  track: Track;
  idleDays: number;
  openTasks: number;
}

export interface RatedTopic {
  topic: Topic;
  track: Track;
}

export interface FocusShare {
  taskId: string | null;
  title: string;
  trackName: string | null;
  minutes: number;
}

export interface Insights {
  completionsByDay: Map<string, number>;
  totalDone: number;
  doneLast7: number;
  donePrev7: number;
  // Streaks count active days, and one rest day between two active days
  // doesn't break them.
  currentStreak: number;
  longestStreak: number;
  activeDays30: number;
  focusMinutes7: number;
  focusMinutesTotal: number;
  focusLast7: FocusShare[];
  // Columns are weeks (oldest first), rows Monday … Sunday.
  heatmap: HeatCell[][];
  heatmapTotal: number;
  completedLast7: TaskWithPlace[];
  overdue: TaskWithPlace[];
  dueSoon: TaskWithPlace[];
  staleTopics: StaleTopic[];
  shakyTopics: RatedTopic[];
  unratedDone: RatedTopic[];
  idleTracks: { track: Track; idleDays: number; openTasks: number }[];
}

export function computeInsights(snapshot: Snapshot, now = new Date()): Insights {
  const today = startOfDay(now);
  const trackById = new Map(snapshot.tracks.map((t) => [t.id, t]));
  const topicById = new Map(snapshot.topics.map((t) => [t.id, t]));
  const place = (task: Task): TaskWithPlace => ({
    task,
    topic: topicById.get(task.topic_id),
    track: trackById.get(task.track_id),
  });

  const completionsByDay = new Map<string, number>();
  const lastActivityByTopic = new Map<string, Date>();
  const lastActivityByTrack = new Map<string, Date>();
  let totalDone = 0;
  let doneLast7 = 0;
  let donePrev7 = 0;
  const completedLast7: TaskWithPlace[] = [];

  for (const task of snapshot.tasks) {
    if (!task.done || !task.completed_at) continue;
    const when = new Date(task.completed_at);
    if (Number.isNaN(when.getTime())) continue;
    totalDone++;
    const key = toDateKey(when);
    completionsByDay.set(key, (completionsByDay.get(key) ?? 0) + 1);

    const age = daysBetween(today, when);
    if (age >= 0 && age < 7) {
      doneLast7++;
      completedLast7.push(place(task));
    } else if (age >= 7 && age < 14) {
      donePrev7++;
    }

    const prevTopic = lastActivityByTopic.get(task.topic_id);
    if (!prevTopic || when > prevTopic) lastActivityByTopic.set(task.topic_id, when);
    const prevTrack = lastActivityByTrack.get(task.track_id);
    if (!prevTrack || when > prevTrack) lastActivityByTrack.set(task.track_id, when);
  }
  completedLast7.sort((a, b) => (b.task.completed_at ?? "").localeCompare(a.task.completed_at ?? ""));

  // A streak is a run of active days where no two neighbours are more
  // than two days apart, i.e. one missed day is forgiven. Missing a day
  // is normal; the run only ends when you've been away for two.
  const days = [...completionsByDay.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const date = fromDateKey(key);
    run = prev && daysBetween(date, prev) <= 2 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = date;
  }
  // Still alive if the last active day was today, yesterday, or the day
  // before (today isn't over yet).
  const currentStreak = prev && daysBetween(today, prev) <= 2 ? run : 0;

  let activeDays30 = 0;
  for (const key of days) {
    const age = daysBetween(today, fromDateKey(key));
    if (age >= 0 && age < 30) activeDays30++;
  }

  // Heatmap: HEATMAP_WEEKS Monday-first columns ending with this week.
  const mondayOffset = (today.getDay() + 6) % 7;
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  const firstMonday = new Date(
    thisMonday.getFullYear(),
    thisMonday.getMonth(),
    thisMonday.getDate() - (HEATMAP_WEEKS - 1) * 7,
  );
  let busiest = 0;
  const cells: HeatCell[][] = [];
  let heatmapTotal = 0;
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + w * 7 + d);
      const key = toDateKey(date);
      const count = completionsByDay.get(key) ?? 0;
      busiest = Math.max(busiest, count);
      heatmapTotal += count;
      column.push({ key, count, level: 0, future: date > today });
    }
    cells.push(column);
  }
  for (const column of cells) {
    for (const cell of column) {
      if (cell.count === 0 || busiest === 0) continue;
      const ratio = cell.count / busiest;
      cell.level = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
    }
  }

  // Only active tracks are "needing attention"; paused and archived ones
  // are parked on purpose.
  const activeTrackIds = new Set(snapshot.tracks.filter((t) => t.status === "active").map((t) => t.id));
  const open = snapshot.tasks.filter((t) => !t.done && activeTrackIds.has(t.track_id));

  const overdue = open
    .filter((t) => t.due_date && daysBetween(fromDateKey(t.due_date), today) < 0)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .map(place);
  const dueSoon = open
    .filter((t) => {
      if (!t.due_date) return false;
      const delta = daysBetween(fromDateKey(t.due_date), today);
      return delta >= 0 && delta <= 7;
    })
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .map(place);

  const openByTopic = new Map<string, number>();
  const openByTrack = new Map<string, number>();
  for (const t of open) {
    openByTopic.set(t.topic_id, (openByTopic.get(t.topic_id) ?? 0) + 1);
    openByTrack.set(t.track_id, (openByTrack.get(t.track_id) ?? 0) + 1);
  }

  // A topic you've started but haven't touched in two weeks. With no
  // finished task to go by, the topic's own creation date stands in.
  const staleTopics: StaleTopic[] = [];
  for (const topic of snapshot.topics) {
    const track = trackById.get(topic.track_id);
    if (!track || track.status !== "active" || topic.status !== "in_progress") continue;
    const openTasks = openByTopic.get(topic.id) ?? 0;
    if (openTasks === 0) continue;
    const last = lastActivityByTopic.get(topic.id) ?? new Date(topic.created_at);
    const idleDays = daysBetween(today, last);
    if (idleDays >= STALE_AFTER_DAYS) staleTopics.push({ topic, track, idleDays, openTasks });
  }
  staleTopics.sort((a, b) => b.idleDays - a.idleDays);

  // Focus time: what the last week's blocks went on.
  const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));
  let focusMinutesTotal = 0;
  let focusMinutes7 = 0;
  const byTask = new Map<string, FocusShare>();
  for (const s of snapshot.sessions ?? []) {
    focusMinutesTotal += s.minutes;
    const when = new Date(s.started_at);
    const age = Number.isNaN(when.getTime()) ? Infinity : daysBetween(today, when);
    if (age < 0 || age >= 7) continue;
    focusMinutes7 += s.minutes;
    const task = s.task_id ? taskById.get(s.task_id) : undefined;
    const key = task ? task.id : "none";
    const share = byTask.get(key) ?? {
      taskId: task?.id ?? null,
      title: task?.title ?? "Not tied to a task",
      trackName: task ? (trackById.get(task.track_id)?.name ?? null) : null,
      minutes: 0,
    };
    share.minutes += s.minutes;
    byTask.set(key, share);
  }
  const focusLast7 = [...byTask.values()].sort((a, b) => b.minutes - a.minutes);

  const shakyTopics: RatedTopic[] = [];
  const unratedDone: RatedTopic[] = [];
  for (const topic of snapshot.topics) {
    const track = trackById.get(topic.track_id);
    if (!track || track.status !== "active" || topic.title === "Reviews") continue;
    if (topic.confidence === "shaky") shakyTopics.push({ topic, track });
    else if (!topic.confidence && topic.status === "done") unratedDone.push({ topic, track });
  }

  const idleTracks: Insights["idleTracks"] = [];
  for (const track of snapshot.tracks) {
    if (track.status !== "active") continue;
    const openTasks = openByTrack.get(track.id) ?? 0;
    if (openTasks === 0) continue;
    const last = lastActivityByTrack.get(track.id) ?? new Date(track.created_at);
    const idleDays = daysBetween(today, last);
    if (idleDays >= STALE_AFTER_DAYS) idleTracks.push({ track, idleDays, openTasks });
  }
  idleTracks.sort((a, b) => b.idleDays - a.idleDays);

  return {
    completionsByDay,
    totalDone,
    doneLast7,
    donePrev7,
    currentStreak,
    longestStreak,
    activeDays30,
    focusMinutes7,
    focusMinutesTotal,
    focusLast7,
    heatmap: cells,
    heatmapTotal,
    completedLast7,
    overdue,
    dueSoon,
    staleTopics,
    shakyTopics,
    unratedDone,
    idleTracks,
  };
}
