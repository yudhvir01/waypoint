import type { Confidence, Note, Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "../database.types";
import type { ParsedImport, ParsedTopic } from "../markdownImport";
import { GUEST_USER_ID, getGuestDB, newGuestId, nowIso } from "./guestStore";
import { buildNoteContext, newNote, newestFirst } from "./localNotes";
import { remapSnapshot } from "./localRestore";
import { computeTopicProgress, computeTrackProgress, rankFocusTasks, topicStatusChanges } from "./localRanking";
import {
  type Attachment,
  type AttachmentKind,
  type Backend,
  type CreateTaskInput,
  type FocusTask,
  type ImportedNote,
  type NoteWithContext,
  type RestoreCounts,
  type Snapshot,
  type TaskOrderUpdate,
  type TrackProgress,
  type UpdateTaskInput,
  type UpdateTaskScheduleInput,
} from "./types";

// A local-only backend for trying Waypoint without an account. Every
// track, topic, and task lives in this browser's IndexedDB — there is no
// server, so nothing here ever leaves the device.
export class GuestBackend implements Backend {
  readonly kind = "guest" as const;

  // resolveAttachmentUrl hands the note editor an object URL, which is
  // only ever valid for this tab's lifetime — recreating one on every
  // re-render would leak a blob URL each time, so each id's URL is made
  // once and reused for as long as this backend instance lives (which is
  // the whole session — see BackendProvider's useMemo).
  private readonly attachmentUrls = new Map<string, string>();

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

  async updateTopicConfidence(id: string, confidence: Confidence | null): Promise<void> {
    const db = await getGuestDB();
    const topic = await db.get("topics", id);
    if (!topic) return;
    await db.put("topics", { ...topic, confidence });
  }

  async deleteTopic(id: string): Promise<void> {
    const db = await getGuestDB();
    const tasks = await db.getAllFromIndex("tasks", "topicId", id);
    const tx = db.transaction(["topics", "tasks", "notes"], "readwrite");
    await tx.objectStore("topics").delete(id);
    await Promise.all(tasks.map((t) => tx.objectStore("tasks").delete(t.id)));
    // A task's note outlives the task, as a standalone note.
    for (const task of tasks) {
      const note = await tx.objectStore("notes").index("taskId").get(task.id);
      if (note) await tx.objectStore("notes").put({ ...note, task_id: null });
    }
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
      recurrence: input.recurrence ?? null,
      sort_order: existing.length,
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
      // Left alone unless the caller says something about it.
      ...("recurrence" in input ? { recurrence: input.recurrence ?? null } : {}),
    });
  }

  async updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void> {
    const db = await getGuestDB();
    const task = await db.get("tasks", taskId);
    if (!task) return;
    const patch: Partial<Task> = {};
    if ("dueDate" in input) patch.due_date = input.dueDate || null;
    if ("recurrence" in input) patch.recurrence = input.recurrence ?? null;
    await db.put("tasks", { ...task, ...patch });
  }

  async rescheduleTasks(taskIds: string[], dueDate: string | null): Promise<void> {
    const db = await getGuestDB();
    const tx = db.transaction("tasks", "readwrite");
    for (const id of taskIds) {
      const task = await tx.store.get(id);
      if (task) await tx.store.put({ ...task, due_date: dueDate });
    }
    await tx.done;
  }

  async importSnapshot(data: Snapshot): Promise<RestoreCounts> {
    const db = await getGuestDB();
    const fresh = remapSnapshot(data, GUEST_USER_ID, newGuestId);
    const tx = db.transaction(["tracks", "topics", "tasks", "notes"], "readwrite");
    for (const row of fresh.tracks) tx.objectStore("tracks").put(row);
    for (const row of fresh.topics) tx.objectStore("topics").put(row);
    for (const row of fresh.tasks) tx.objectStore("tasks").put(row);
    for (const row of fresh.notes) tx.objectStore("notes").put(row);
    // One transaction: it all lands, or none of it does.
    await tx.done;
    return {
      tracks: fresh.tracks.length,
      topics: fresh.topics.length,
      tasks: fresh.tasks.length,
      notes: fresh.notes.length,
    };
  }

  async reorderTasks(updates: TaskOrderUpdate[]): Promise<void> {
    const db = await getGuestDB();
    const tx = db.transaction("tasks", "readwrite");
    for (const { id, sort_order } of updates) {
      const task = await tx.store.get(id);
      if (task) await tx.store.put({ ...task, sort_order });
    }
    await tx.done;
  }

  async deleteTask(taskId: string): Promise<void> {
    const db = await getGuestDB();
    const tx = db.transaction(["tasks", "notes"], "readwrite");
    await tx.objectStore("tasks").delete(taskId);
    const note = await tx.objectStore("notes").index("taskId").get(taskId);
    if (note) await tx.objectStore("notes").put({ ...note, task_id: null });
    await tx.done;
  }

  async toggleTask(task: Task): Promise<void> {
    const db = await getGuestDB();
    const current = await db.get("tasks", task.id);
    if (!current) return;
    const done = !current.done;
    await db.put("tasks", { ...current, done, completed_at: done ? nowIso() : null });

    const topic = await db.get("topics", current.topic_id);
    if (!topic) return;
    const [topics, tasks] = await Promise.all([
      db.getAllFromIndex("topics", "trackId", topic.track_id),
      db.getAllFromIndex("tasks", "topicId", topic.id),
    ]);
    for (const change of topicStatusChanges(topics, tasks, topic.id)) {
      const row = topics.find((t) => t.id === change.id);
      if (row) await db.put("topics", { ...row, status: change.status });
    }
  }

  async listNotes(): Promise<Note[]> {
    const db = await getGuestDB();
    return (await db.getAll("notes")).sort(newestFirst);
  }

  async getNote(id: string): Promise<NoteWithContext | null> {
    const db = await getGuestDB();
    const note = await db.get("notes", id);
    if (!note) return null;
    const task = note.task_id ? await db.get("tasks", note.task_id) : undefined;
    const topic = task ? await db.get("topics", task.topic_id) : undefined;
    const track = task ? await db.get("tracks", task.track_id) : undefined;
    return { ...note, context: buildNoteContext(note, task, topic, track) };
  }

  async createNote(input: { title?: string; content?: string } = {}): Promise<Note> {
    const db = await getGuestDB();
    const note = newNote(newGuestId(), GUEST_USER_ID, nowIso(), input);
    await db.put("notes", note);
    return note;
  }

  async updateNote(id: string, patch: { title?: string; content?: string }): Promise<void> {
    const db = await getGuestDB();
    const note = await db.get("notes", id);
    if (!note) return;
    await db.put("notes", { ...note, ...patch, updated_at: nowIso() });
  }

  async deleteNote(id: string): Promise<void> {
    const db = await getGuestDB();
    await db.delete("notes", id);
  }

  async getOrCreateTaskNote(taskId: string): Promise<Note | null> {
    const db = await getGuestDB();
    const existing = await db.getFromIndex("notes", "taskId", taskId);
    if (existing) return existing;
    const task = await db.get("tasks", taskId);
    if (!task) return null;
    const note = newNote(newGuestId(), GUEST_USER_ID, nowIso(), { title: task.title, taskId });
    await db.put("notes", note);
    return note;
  }

  async importNotes(notes: ImportedNote[]): Promise<void> {
    for (const n of notes) await this.createNote(n);
  }

  async uploadAttachment(file: File, kind: AttachmentKind): Promise<Attachment> {
    const db = await getGuestDB();
    const id = newGuestId();
    await db.put("attachments", { id, blob: file, name: file.name, contentType: file.type });
    return { id, kind, name: file.name, contentType: file.type };
  }

  async resolveAttachmentUrl(id: string): Promise<string> {
    const cached = this.attachmentUrls.get(id);
    if (cached) return cached;
    const db = await getGuestDB();
    const row = await db.get("attachments", id);
    if (!row) throw new Error("That attachment no longer exists.");
    const url = URL.createObjectURL(row.blob);
    this.attachmentUrls.set(id, url);
    return url;
  }

  async trackProgress(): Promise<Map<string, TrackProgress>> {
    const db = await getGuestDB();
    const [tracks, tasks] = await Promise.all([db.getAll("tracks"), db.getAll("tasks")]);
    const map = computeTrackProgress(tasks);
    // computeTrackProgress only knows about tasks, so a track with none
    // never appears — which is exactly what the sidebar wants (no "0/0"
    // rows), but it has no way to distinguish "no tasks" from "no such
    // track" on its own, hence checking against the real track list here.
    const trackIds = new Set(tracks.map((t) => t.id));
    for (const id of map.keys()) if (!trackIds.has(id)) map.delete(id);
    return map;
  }

  async topicProgress(trackId: string): Promise<Map<string, TrackProgress>> {
    const db = await getGuestDB();
    const tasks = await db.getAllFromIndex("tasks", "trackId", trackId);
    return computeTopicProgress(tasks, trackId);
  }

  async focusTasks(limit: number): Promise<FocusTask[]> {
    const db = await getGuestDB();
    const [tracks, topics, tasks] = await Promise.all([
      db.getAll("tracks"),
      db.getAll("topics"),
      db.getAll("tasks"),
    ]);
    return rankFocusTasks(tracks, topics, tasks, limit);
  }

  async snapshot(options: { notes?: boolean } = {}): Promise<Snapshot> {
    const db = await getGuestDB();
    const [tracks, topics, tasks, notes] = await Promise.all([
      db.getAll("tracks"),
      db.getAll("topics"),
      db.getAll("tasks"),
      options.notes === false ? Promise.resolve([] as Note[]) : db.getAll("notes"),
    ]);
    return { tracks, topics, tasks, notes };
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
          recurrence: task.recurrence ?? null,
          sort_order: taskIndex,
          created_at: nowIso(),
        };
        await db.put("tasks", taskRow);
      }
    }

    return track.id;
  }

  // Used by the "move to Supabase"/"move to Google Drive" migration in
  // Settings — every guest track, restated as the shape importTrack()
  // already knows how to consume, so migrating is "read these,
  // import_track() each one" rather than a second data-shuffling path to
  // maintain.
  //
  // Known gap: a note's HTML can reference attachment ids that only
  // exist in this guest's IndexedDB (see uploadAttachment/
  // resolveAttachmentUrl). Those ids carry over verbatim into the new
  // backend's copy of the note, where they don't resolve to anything —
  // the attachment node just shows "couldn't load" after migrating. Text
  // content migrates cleanly either way; only embedded files are lost.
  async exportAllNotes(): Promise<ImportedNote[]> {
    const db = await getGuestDB();
    const notes = await db.getAll("notes");
    return notes.filter((n) => n.title || n.content).map((n) => ({ title: n.title, content: n.content }));
  }

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
            recurrence: task.recurrence ?? null,
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
