import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FocusTask, NoteWithContext, Snapshot, TrackProgress } from "./backend/types";
import type { Note, Task, Topic, Track, Waypoint } from "./database.types";
import { focusTier, topicStatusChanges } from "./backend/localRanking";

// What a change looks like on screen before the backend has heard about
// it. Each function edits the cached lists in place of a refetch, so a
// tick, a delete or a new note shows the moment it happens; the saves
// follow behind (see useWrite.ts), and a refetch once they're done
// replaces all of this with what was actually stored.

type Pages<T> = InfiniteData<T[]>;
type ProgressMap = Map<string, TrackProgress>;

const nowIso = () => new Date().toISOString();

function editPages<T>(qc: QueryClient, key: string[], edit: (rows: T[]) => T[]) {
  qc.setQueriesData<Pages<T>>({ queryKey: key }, (old) => old && { ...old, pages: old.pages.map(edit) });
}

function editList<T>(qc: QueryClient, key: string[], edit: (rows: T[]) => T[]) {
  qc.setQueriesData<T[]>({ queryKey: key }, (old) => old && edit(old));
}

// The whole-account copy that Search and the weekly review read.
function editSnapshotTasks(qc: QueryClient, edit: (rows: Task[]) => Task[]) {
  qc.setQueriesData<Snapshot>({ queryKey: ["snapshot"] }, (old) => old && { ...old, tasks: edit(old.tasks) });
}

function bump(map: ProgressMap | undefined, id: string, done: number, total: number): ProgressMap | undefined {
  if (!map) return map;
  const next = new Map(map);
  const was = next.get(id) ?? { done: 0, total: 0 };
  next.set(id, { done: Math.max(0, was.done + done), total: Math.max(0, was.total + total) });
  return next;
}

// Keeps the sidebar's "3/10" and the topic counts in step with a task
// that was added, removed, ticked or unticked.
function countTask(qc: QueryClient, task: Pick<Task, "track_id" | "topic_id">, done: number, total: number) {
  qc.setQueryData<ProgressMap>(["trackProgress"], (old) => bump(old, task.track_id, done, total));
  qc.setQueryData<ProgressMap>(["topicProgress", task.track_id], (old) => bump(old, task.topic_id, done, total));
}

// ---- Tasks

export function findTask(qc: QueryClient, id: string): Task | undefined {
  for (const [, data] of qc.getQueriesData<Pages<Task>>({ queryKey: ["tasks"] })) {
    const hit = data?.pages.flat().find((t) => t.id === id);
    if (hit) return hit;
  }
  for (const key of ["focusNow", "planned"]) {
    for (const [, data] of qc.getQueriesData<FocusTask[]>({ queryKey: [key] })) {
      const hit = data?.find((t) => t.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function topicTasks(qc: QueryClient, topicId: string): Task[] | undefined {
  return qc.getQueryData<Pages<Task>>(["tasks", topicId])?.pages.flat();
}

export function patchTasks(qc: QueryClient, ids: Set<string>, patch: Partial<Task>) {
  const edit = <T extends Task>(rows: T[]) => rows.map((t) => (ids.has(t.id) ? { ...t, ...patch } : t));
  editPages<Task>(qc, ["tasks"], edit);
  editList<FocusTask>(qc, ["focusNow"], edit);
  editList<FocusTask>(qc, ["planned"], edit);
  editSnapshotTasks(qc, edit);
}

export function patchTask(qc: QueryClient, id: string, patch: Partial<Task>) {
  patchTasks(qc, new Set([id]), patch);
}

export function addTask(qc: QueryClient, task: Task) {
  qc.setQueryData<Pages<Task>>(["tasks", task.topic_id], (old) => {
    if (!old) return old;
    const pages = [...old.pages];
    pages[pages.length - 1] = [...pages[pages.length - 1], task];
    return { ...old, pages };
  });
  editSnapshotTasks(qc, (rows) => [...rows, task]);
  countTask(qc, task, 0, 1);
}

// A new open task on Today, slotted in among the others of its tier.
// The exact order arrives with the refetch.
export function addFocusTask(qc: QueryClient, task: FocusTask) {
  qc.setQueryData<FocusTask[]>(["focusNow"], (old) => {
    if (!old || old.some((t) => t.id === task.id)) return old;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tier = focusTier(task, today);
    const at = old.findIndex((t) => focusTier(t, today) > tier);
    return at < 0 ? [...old, task] : [...old.slice(0, at), task, ...old.slice(at)];
  });
}

export function removeTasks(qc: QueryClient, match: (t: Task) => boolean) {
  const removed = new Map<string, Task>();
  const drop = <T extends Task>(rows: T[]) =>
    rows.filter((t) => {
      if (!match(t)) return true;
      removed.set(t.id, t);
      return false;
    });
  editPages<Task>(qc, ["tasks"], drop);
  editList<FocusTask>(qc, ["focusNow"], drop);
  editList<FocusTask>(qc, ["planned"], drop);
  editSnapshotTasks(qc, drop);
  for (const t of removed.values()) countTask(qc, t, t.done ? -1 : 0, -1);
}

// A task's topic moves along when its last task is ticked (and the next
// one starts), exactly as the backends do it.
function syncTopicStatus(qc: QueryClient, task: Task) {
  const tasks = topicTasks(qc, task.topic_id);
  const topics = qc.getQueryData<Pages<Topic>>(["topics", task.track_id])?.pages.flat();
  if (!tasks || !topics) return;
  for (const change of topicStatusChanges(topics, tasks, task.topic_id)) {
    patchTopic(qc, change.id, { status: change.status });
  }
}

export function toggleTask(qc: QueryClient, task: Task) {
  const done = !task.done;
  patchTask(qc, task.id, { done, completed_at: done ? nowIso() : null });
  countTask(qc, task, done ? 1 : -1, 0);
  if (done) {
    editList<FocusTask>(qc, ["focusNow"], (rows) => rows.filter((t) => t.id !== task.id));
  } else if ("topic" in task) {
    addFocusTask(qc, { ...(task as FocusTask), done: false, completed_at: null });
  }
  syncTopicStatus(qc, { ...task, done });
}

// ---- Topics

export function patchTopic(qc: QueryClient, id: string, patch: Partial<Topic>) {
  editPages<Topic>(qc, ["topics"], (rows) => rows.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function addTopic(qc: QueryClient, topic: Topic) {
  qc.setQueryData<Pages<Topic>>(["topics", topic.track_id], (old) => {
    if (!old) return old;
    const pages = [...old.pages];
    const last = pages[pages.length - 1];
    const sort_order = Math.max(-1, ...old.pages.flat().map((t) => t.sort_order)) + 1;
    pages[pages.length - 1] = [...last, { ...topic, sort_order }];
    return { ...old, pages };
  });
}

export function removeTopic(qc: QueryClient, id: string) {
  editPages<Topic>(qc, ["topics"], (rows) => rows.filter((t) => t.id !== id));
  removeTasks(qc, (t) => t.topic_id === id);
}

// ---- Tracks

export function findTrack(qc: QueryClient, id: string): Track | undefined {
  const single = qc.getQueryData<Track | null>(["track", id]);
  if (single) return single;
  for (const [, rows] of qc.getQueriesData<Track[]>({ queryKey: ["tracks"] })) {
    const hit = rows?.find((t) => t.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function addTrack(qc: QueryClient, track: Track) {
  qc.setQueryData<Track[]>(["tracks", track.status], (old) => old && [track, ...old]);
  qc.setQueryData(["track", track.id], track);
  qc.setQueryData<Pages<Topic>>(["topics", track.id], { pages: [[]], pageParams: [0] });
}

export function patchTrack(qc: QueryClient, id: string, patch: Partial<Track>) {
  const before = findTrack(qc, id);
  qc.setQueryData<Track | null>(["track", id], (old) => old && { ...old, ...patch });
  if (!before) {
    editList<Track>(qc, ["tracks"], (rows) => rows.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    return;
  }
  const after = { ...before, ...patch };
  if (after.status !== before.status) {
    qc.setQueryData<Track[]>(["tracks", before.status], (old) => old?.filter((t) => t.id !== id));
    qc.setQueryData<Track[]>(["tracks", after.status], (old) =>
      old && [after, ...old].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
    // Only active tracks feed Today.
    if (after.status !== "active") {
      editList<FocusTask>(qc, ["focusNow"], (rows) => rows.filter((t) => t.topic.track.id !== id));
    }
  } else {
    qc.setQueryData<Track[]>(["tracks", before.status], (old) => old?.map((t) => (t.id === id ? after : t)));
  }
}

export function removeTrack(qc: QueryClient, id: string) {
  editList<Track>(qc, ["tracks"], (rows) => rows.filter((t) => t.id !== id));
  qc.setQueryData<ProgressMap>(["trackProgress"], (old) => {
    if (!old) return old;
    const next = new Map(old);
    next.delete(id);
    return next;
  });
  editList<FocusTask>(qc, ["focusNow"], (rows) => rows.filter((t) => t.topic.track.id !== id));
  editList<FocusTask>(qc, ["planned"], (rows) => rows.filter((t) => t.topic.track.id !== id));
  qc.removeQueries({ queryKey: ["topics", id] });
  qc.removeQueries({ queryKey: ["topicProgress", id] });
}

// ---- Notes

export function addNote(qc: QueryClient, note: Note) {
  editList<Note>(qc, ["notes"], (rows) => [note, ...rows]);
  qc.setQueryData<NoteWithContext>(["note", note.id], { ...note, context: null });
}

// Notes deleted in this session, so a closing editor's last edits for one
// are dropped instead of written to a note that's gone.
export const deletedNotes = new Set<string>();

export function removeNote(qc: QueryClient, id: string) {
  deletedNotes.add(id);
  editList<Note>(qc, ["notes"], (rows) => rows.filter((n) => n.id !== id));
  qc.removeQueries({ queryKey: ["note", id] });
}

export function patchNote(qc: QueryClient, id: string, patch: Partial<Note>) {
  const updated_at = nowIso();
  qc.setQueryData<NoteWithContext | null>(["note", id], (old) => old && { ...old, ...patch, updated_at });
  editList<Note>(qc, ["notes"], (rows) => rows.map((n) => (n.id === id ? { ...n, ...patch, updated_at } : n)));
}

// ---- Day lines

export function addWaypoint(qc: QueryClient, waypoint: Waypoint) {
  editList<Waypoint>(qc, ["waypoints"], (rows) => [waypoint, ...rows]);
}

export function removeWaypoint(qc: QueryClient, id: string) {
  editList<Waypoint>(qc, ["waypoints"], (rows) => rows.filter((w) => w.id !== id));
}
