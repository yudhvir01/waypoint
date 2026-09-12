import type { Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "../database.types";
import type { ParsedImport, ParsedTopic } from "../markdownImport";
import { GUEST_USER_ID, getGuestDB, newGuestId, nowIso } from "./guestStore";
import {
  DEFAULT_REMINDER_PREFS,
  type Backend,
  type CreateTaskInput,
  type FocusTask,
  type ReminderPrefs,
  type TrackProgress,
  type UpdateTaskInput,
  type UpdateTaskScheduleInput,
} from "./types";

// Mirrors the ranking in setup.sql's focus_tasks(): overdue first, then
// due within two days, then priority, each tier ordered by due date /
// creation. Kept in JS here because a guest's whole dataset already lives
// in memory — there's no index to design around.
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

// A local-only backend for trying Waypoint without an account. Every
// track, topic, and task lives in this browser's IndexedDB — there is no
// server, so nothing here ever leaves the device, and nothing here can
// send an email or a push notification (see `supportsReminders`).
export class GuestBackend implements Backend {
  readonly kind = "guest" as const;
  readonly supportsReminders = false;

  async listTracks(status: TrackStatus): Promise<Track[]> {
    const db = await getGuestDB();
    const rows = await db.getAllFromIndex("tracks", "status", status);
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getTrack(id: string): Promise<Track | null> {
    const db = await getGuestDB();
    return (await db.get("tracks", id)) ?? null;
  }

  async createTrack(input: { name: string; description?: string | null }): Promise<Track> {
    const db = await getGuestDB();
    const track: Track = {
      id: newGuestId(),
      user_id: GUEST_USER_ID,
      name: input.name,
      description: input.description ?? null,
      color: null,
      status: "active",
      created_at: nowIso(),
    };
    await db.put("tracks", track);
    return track;
  }

  async updateTrackStatus(id: string, status: TrackStatus): Promise<void> {
    const db = await getGuestDB();
    const track = await db.get("tracks", id);
    if (!track) return;
    await db.put("tracks", { ...track, status });
  }

  async listTopics(trackId: string, page: number, pageSize: number): Promise<Topic[]> {
    const db = await getGuestDB();
    const rows = (await db.getAllFromIndex("topics", "trackId", trackId)).sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    return rows.slice(page * pageSize, page * pageSize + pageSize);
  }

  async createTopic(trackId: string, title: string): Promise<Topic> {
    const db = await getGuestDB();
    const existing = await db.getAllFromIndex("topics", "trackId", trackId);
    const topic: Topic = {
      id: newGuestId(),
      track_id: trackId,
      user_id: GUEST_USER_ID,
      title,
      status: "not_started",
      sort_order: existing.length,
      created_at: nowIso(),
    };
    await db.put("topics", topic);
    return topic;
  }

  async updateTopicStatus(id: string, status: TopicStatus): Promise<void> {
    const db = await getGuestDB();
    const topic = await db.get("topics", id);
    if (!topic) return;
    await db.put("topics", { ...topic, status });
  }

  async updateTopicTitle(id: string, title: string): Promise<void> {
    const db = await getGuestDB();
    const topic = await db.get("topics", id);
    if (!topic) return;
    await db.put("topics", { ...topic, title });
  }

  async deleteTopic(id: string): Promise<void> {
    const db = await getGuestDB();
    const tasks = await db.getAllFromIndex("tasks", "topicId", id);
    const tx = db.transaction(["topics", "tasks"], "readwrite");
    await tx.objectStore("topics").delete(id);
    await Promise.all(tasks.map((t) => tx.objectStore("tasks").delete(t.id)));
    await tx.done;
  }

  async listTasks(topicId: string, page: number, pageSize: number): Promise<Task[]> {
    const db = await getGuestDB();
    const rows = (await db.getAllFromIndex("tasks", "topicId", topicId)).sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    return rows.slice(page * pageSize, page * pageSize + pageSize);
  }

  async createTask(topicId: string, input: CreateTaskInput): Promise<Task> {
    const db = await getGuestDB();
    const topic = await db.get("topics", topicId);
    if (!topic) throw new Error("That topic no longer exists.");
    const existing = await db.getAllFromIndex("tasks", "topicId", topicId);
    const task: Task = {
      id: newGuestId(),
      topic_id: topicId,
      track_id: topic.track_id,
      title: input.title,
      done: false,
      priority: input.priority ?? "none",
      due_date: input.dueDate || null,
      completed_at: null,
      sort_order: existing.length,
      reminder_lead_days: input.dueDate ? (input.reminderLeadDays ?? null) : null,
      created_at: nowIso(),
    };
    await db.put("tasks", task);
    return task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    const db = await getGuestDB();
    const task = await db.get("tasks", taskId);
    if (!task) return;
    await db.put("tasks", {
      ...task,
      title: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      reminder_lead_days: input.dueDate ? input.reminderLeadDays : null,
    });
  }

  async updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void> {
    const db = await getGuestDB();
    const task = await db.get("tasks", taskId);
    if (!task) return;
    const patch: Partial<Task> = {};
    if ("dueDate" in input) patch.due_date = input.dueDate || null;
    if ("reminderLeadDays" in input) patch.reminder_lead_days = input.reminderLeadDays ?? null;
    await db.put("tasks", { ...task, ...patch });
  }

  async deleteTask(taskId: string): Promise<void> {
    const db = await getGuestDB();
    await db.delete("tasks", taskId);
  }

  async toggleTask(task: Task): Promise<void> {
    const db = await getGuestDB();
    const current = await db.get("tasks", task.id);
    if (!current) return;
    const done = !current.done;
    await db.put("tasks", { ...current, done, completed_at: done ? nowIso() : null });
  }

  async trackProgress(): Promise<Map<string, TrackProgress>> {
    const db = await getGuestDB();
    const [tracks, tasks] = await Promise.all([db.getAll("tracks"), db.getAll("tasks")]);
    const map = new Map<string, TrackProgress>();
    for (const track of tracks) map.set(track.id, { done: 0, total: 0 });
    for (const task of tasks) {
      const entry = map.get(task.track_id);
      if (!entry) continue;
      entry.total += 1;
      if (task.done) entry.done += 1;
    }
    for (const [id, entry] of map) if (entry.total === 0) map.delete(id);
    return map;
  }

  async topicProgress(trackId: string): Promise<Map<string, TrackProgress>> {
    const db = await getGuestDB();
    const tasks = await db.getAllFromIndex("tasks", "trackId", trackId);
    const map = new Map<string, TrackProgress>();
    for (const task of tasks) {
      const entry = map.get(task.topic_id) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (task.done) entry.done += 1;
      map.set(task.topic_id, entry);
    }
    return map;
  }

  async focusTasks(limit: number): Promise<FocusTask[]> {
    const db = await getGuestDB();
    const [tracks, topics, tasks] = await Promise.all([
      db.getAll("tracks"),
      db.getAll("topics"),
      db.getAll("tasks"),
    ]);
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
        return a.created_at.localeCompare(b.created_at);
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

  async importTrack(parsed: ParsedImport): Promise<string> {
    const db = await getGuestDB();
    const track = await this.createTrack({ name: parsed.trackName, description: parsed.description });

    for (const [topicIndex, topic] of parsed.topics.entries()) {
      const topicRow: Topic = {
        id: newGuestId(),
        track_id: track.id,
        user_id: GUEST_USER_ID,
        title: topic.title,
        status: topic.tasks.length > 0 && topic.tasks.every((t) => t.done) ? "done" : "not_started",
        sort_order: topicIndex,
        created_at: nowIso(),
      };
      await db.put("topics", topicRow);

      for (const [taskIndex, task] of topic.tasks.entries()) {
        const taskRow: Task = {
          id: newGuestId(),
          topic_id: topicRow.id,
          track_id: track.id,
          title: task.title,
          done: task.done,
          priority: task.priority as TaskPriority,
          due_date: task.dueDate,
          completed_at: task.done ? nowIso() : null,
          sort_order: taskIndex,
          reminder_lead_days: null,
          created_at: nowIso(),
        };
        await db.put("tasks", taskRow);
      }
    }

    return track.id;
  }

  async getReminderPrefs(): Promise<ReminderPrefs> {
    return DEFAULT_REMINDER_PREFS;
  }

  async updateReminderPrefs(): Promise<void> {
    // No-op: reminders need a server to act while you're not looking, and
    // a guest backend has none. Settings hides the toggles instead of
    // calling this, but a stub keeps the interface total.
  }

  // Used by the "move to Supabase" migration in Settings — every guest
  // track, restated as the shape importTrack() already knows how to
  // consume, so migrating is "read these, import_track() each one" rather
  // than a second data-shuffling path to maintain.
  async exportAllAsImports(): Promise<ParsedImport[]> {
    const db = await getGuestDB();
    const [tracks, topics, tasks] = await Promise.all([
      db.getAll("tracks"),
      db.getAll("topics"),
      db.getAll("tasks"),
    ]);
    const topicsByTrack = new Map<string, Topic[]>();
    for (const topic of topics) {
      const list = topicsByTrack.get(topic.track_id) ?? [];
      list.push(topic);
      topicsByTrack.set(topic.track_id, list);
    }
    const tasksByTopic = new Map<string, Task[]>();
    for (const task of tasks) {
      const list = tasksByTopic.get(task.topic_id) ?? [];
      list.push(task);
      tasksByTopic.set(task.topic_id, list);
    }

    return tracks.map((track) => {
      const trackTopics = (topicsByTrack.get(track.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
      const parsedTopics: ParsedTopic[] = trackTopics.map((topic) => ({
        title: topic.title,
        tasks: (tasksByTopic.get(topic.id) ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((task) => ({
            title: task.title,
            done: task.done,
            priority: task.priority,
            dueDate: task.due_date,
          })),
      }));
      return {
        trackName: track.name,
        description: track.description,
        topics: parsedTopics,
        warnings: [],
      };
    });
  }
}
