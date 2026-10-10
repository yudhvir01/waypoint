import type { Snapshot } from "./backend/types";
import type { Card, Confidence, Note, Recurrence, Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "./database.types";
import { isRecurrence } from "./recurrence";

// Reading a backup file back in. The file is untrusted input (edited by
// hand, from another version, or not a Waypoint file at all), so every
// field is checked and only known fields are kept.

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 100_000;

const TRACK_STATUSES: TrackStatus[] = ["active", "paused", "archived"];
const TOPIC_STATUSES: TopicStatus[] = ["not_started", "in_progress", "done"];
const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];
const CONFIDENCES: Confidence[] = ["shaky", "okay", "solid"];

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function isoOr(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}
function dateKeyOrNull(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

export interface ParsedBackup {
  snapshot: Snapshot;
  exportedAt: string | null;
  skipped: number;
}

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) {
    throw new Error("That file is too large to be a Waypoint backup.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const root = obj(raw);
  if (!root || root.app !== "waypoint") {
    throw new Error("That doesn't look like a Waypoint backup (it should come from Settings → Download .json).");
  }
  if (typeof root.version === "number" && root.version > 1) {
    throw new Error("That backup was made by a newer version of Waypoint. Update the app and try again.");
  }
  const list = (key: string): unknown[] => (Array.isArray(root[key]) ? (root[key] as unknown[]) : []);
  const rawTracks = list("tracks");
  const rawTopics = list("topics");
  const rawTasks = list("tasks");
  const rawNotes = list("notes");
  const rawCards = list("cards");
  if (rawTracks.length + rawTopics.length + rawTasks.length + rawNotes.length + rawCards.length > MAX_ROWS) {
    throw new Error("That backup has too many rows to restore in one go.");
  }

  const epoch = new Date().toISOString();
  let skipped = 0;

  const tracks: Track[] = [];
  for (const r of rawTracks) {
    const o = obj(r);
    const id = o && str(o.id);
    const name = o && str(o.name)?.trim();
    if (!o || !id || !name) {
      skipped++;
      continue;
    }
    tracks.push({
      id,
      user_id: "",
      name,
      description: str(o.description),
      color: str(o.color),
      status: oneOf(o.status, TRACK_STATUSES, "active"),
      created_at: isoOr(o.created_at, epoch),
    });
  }

  const topics: Topic[] = [];
  for (const r of rawTopics) {
    const o = obj(r);
    const id = o && str(o.id);
    const trackId = o && str(o.track_id);
    const title = o && str(o.title)?.trim();
    if (!o || !id || !trackId || !title) {
      skipped++;
      continue;
    }
    topics.push({
      id,
      track_id: trackId,
      user_id: "",
      title,
      status: oneOf(o.status, TOPIC_STATUSES, "not_started"),
      confidence: CONFIDENCES.includes(o.confidence as Confidence) ? (o.confidence as Confidence) : null,
      sort_order: int(o.sort_order),
      created_at: isoOr(o.created_at, epoch),
    });
  }

  const tasks: Task[] = [];
  for (const r of rawTasks) {
    const o = obj(r);
    const id = o && str(o.id);
    const topicId = o && str(o.topic_id);
    const title = o && str(o.title)?.trim();
    if (!o || !id || !topicId || !title) {
      skipped++;
      continue;
    }
    const done = o.done === true;
    tasks.push({
      id,
      topic_id: topicId,
      track_id: str(o.track_id) ?? "",
      title,
      done,
      priority: oneOf(o.priority, PRIORITIES, "none"),
      due_date: dateKeyOrNull(o.due_date),
      completed_at: done ? isoOr(o.completed_at, epoch) : null,
      recurrence: isRecurrence(o.recurrence) ? (o.recurrence as Recurrence) : null,
      sort_order: int(o.sort_order),
      created_at: isoOr(o.created_at, epoch),
    });
  }

  const notes: Note[] = [];
  for (const r of rawNotes) {
    const o = obj(r);
    const id = o && str(o.id);
    if (!o || !id) {
      skipped++;
      continue;
    }
    notes.push({
      id,
      user_id: "",
      task_id: str(o.task_id),
      title: str(o.title) ?? "",
      content: str(o.content) ?? "",
      created_at: isoOr(o.created_at, epoch),
      updated_at: isoOr(o.updated_at, isoOr(o.created_at, epoch)),
    });
  }

  const cards: Card[] = [];
  for (const r of rawCards) {
    const o = obj(r);
    const id = o && str(o.id);
    const front = o && str(o.front)?.trim();
    const back = o && str(o.back)?.trim();
    if (!o || !id || !front || !back) {
      skipped++;
      continue;
    }
    const ease = typeof o.ease === "number" && Number.isFinite(o.ease) ? o.ease : 2.5;
    cards.push({
      id,
      user_id: "",
      note_id: str(o.note_id),
      front,
      back,
      due: dateKeyOrNull(o.due) ?? epoch.slice(0, 10),
      interval_days: Math.max(0, int(o.interval_days)),
      ease: Math.min(4, Math.max(1.3, ease)),
      reps: Math.max(0, int(o.reps)),
      lapses: Math.max(0, int(o.lapses)),
      last_reviewed_at: typeof o.last_reviewed_at === "string" ? isoOr(o.last_reviewed_at, epoch) : null,
      created_at: isoOr(o.created_at, epoch),
    });
  }

  if (tracks.length + notes.length === 0) {
    throw new Error("That backup has no tracks or notes in it.");
  }

  return {
    snapshot: { tracks, topics, tasks, notes, cards },
    exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : null,
    skipped,
  };
}
