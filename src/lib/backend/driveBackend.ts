import type { Card, Confidence, FocusSession, Note, Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "../database.types";
import type { ParsedImport } from "../markdownImport";
import {
  createDataFile,
  downloadBinaryFile,
  ensureWaypointFolder,
  loadDataFile,
  saveDataFile,
  uploadBinaryFile,
} from "./driveClient";
import type { GoogleDriveSession } from "./googleAuth";
import { diffCards, newCardSchedule } from "../cards";
import { buildNoteContext, newNote, newestFirst } from "./localNotes";
import { remapSnapshot } from "./localRestore";
import { computeTopicProgress, computeTrackProgress, rankFocusTasks, topicStatusChanges } from "./localRanking";
import {
  type Attachment,
  type AttachmentKind,
  type Backend,
  type CardSchedule,
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

const DATA_VERSION = 1;

interface DriveData {
  version: number;
  tracks: Track[];
  topics: Topic[];
  tasks: Task[];
  notes: Note[];
  cards: Card[];
  sessions: FocusSession[];
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyData(): DriveData {
  return { version: DATA_VERSION, tracks: [], topics: [], tasks: [], notes: [], cards: [], sessions: [] };
}

// The whole account's data is one JSON file in a "Waypoint" folder in the
// user's own Drive — there's no server, so this class holds the entire
// dataset in memory (loaded once, on first use) and rewrites the file
// after every change. That ceiling is why this backend is documented as
// comfortable up to roughly the tens of thousands of tasks, not the
// millions the Supabase backend is built for: every write is a full-file
// PATCH, and every sign-in re-downloads the whole thing.
export class DriveBackend implements Backend {
  readonly kind = "drive" as const;

  private readonly session: GoogleDriveSession;
  private folderId: string | null = null;
  private fileId: string | null = null;
  private headRevisionId: string | undefined;
  private data: DriveData = emptyData();
  private loadPromise: Promise<void> | null = null;
  // Serializes writes so two nearly-simultaneous mutations (a double
  // click, or two browser tabs on the same account) can't both read the
  // same headRevisionId and race to save — the second one always waits
  // for the first to finish and update it first.
  private writeChain: Promise<void> = Promise.resolve();
  // Downloading an attachment needs an authenticated request every time
  // (Drive never hands back a URL that works without one) — cached so a
  // note re-rendering doesn't re-download and re-leak an object URL on
  // every mount.
  private readonly attachmentUrls = new Map<string, string>();

  constructor(session: GoogleDriveSession) {
    this.session = session;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        this.folderId = await ensureWaypointFolder(this.session);
        const file = await loadDataFile(this.session, this.folderId);
        if (file) {
          this.fileId = file.fileId;
          this.headRevisionId = file.headRevisionId;
          try {
            const parsed = JSON.parse(file.content) as Partial<DriveData>;
            this.data = {
              version: DATA_VERSION,
              tracks: parsed.tracks ?? [],
              topics: parsed.topics ?? [],
              tasks: parsed.tasks ?? [],
              notes: parsed.notes ?? [],
              cards: parsed.cards ?? [],
              sessions: parsed.sessions ?? [],
            };
          } catch {
            throw new Error(
              "Couldn't read your Waypoint data file on Drive — it may have been edited outside the app.",
            );
          }
        }
      })();
    }
    return this.loadPromise;
  }

  // Every mutating method ends by calling this. Queued behind
  // `writeChain` rather than called directly, so overlapping calls save
  // one at a time instead of racing.
  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const content = JSON.stringify(this.data);
      if (!this.fileId) {
        const created = await createDataFile(this.session, this.folderId!, content);
        this.fileId = created.fileId;
        this.headRevisionId = created.headRevisionId;
      } else {
        const saved = await saveDataFile(this.session, this.fileId, content, this.headRevisionId);
        this.headRevisionId = saved.headRevisionId;
      }
    });
    return this.writeChain;
  }

  async listTracks(status: TrackStatus): Promise<Track[]> {
    await this.ensureLoaded();
    return this.data.tracks
      .filter((t) => t.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getTrack(id: string): Promise<Track | null> {
    await this.ensureLoaded();
    return this.data.tracks.find((t) => t.id === id) ?? null;
  }

  async createTrack(input: { name: string; description?: string | null }): Promise<Track> {
    await this.ensureLoaded();
    const track: Track = {
      id: newId(),
      user_id: this.session.email,
      name: input.name,
      description: input.description ?? null,
      color: null,
      status: "active",
      created_at: nowIso(),
    };
    this.data.tracks.push(track);
    await this.persist();
    return track;
  }

  async updateTrackStatus(id: string, status: TrackStatus): Promise<void> {
    await this.ensureLoaded();
    const track = this.data.tracks.find((t) => t.id === id);
    if (!track) return;
    track.status = status;
    await this.persist();
  }

  async deleteTrack(id: string): Promise<void> {
    await this.ensureLoaded();
    const taskIds = new Set(this.data.tasks.filter((t) => t.track_id === id).map((t) => t.id));
    this.data.tracks = this.data.tracks.filter((t) => t.id !== id);
    this.data.topics = this.data.topics.filter((t) => t.track_id !== id);
    this.data.tasks = this.data.tasks.filter((t) => t.track_id !== id);
    this.detachNotes(taskIds);
    await this.persist();
  }

  async listTopics(trackId: string, page: number, pageSize: number): Promise<Topic[]> {
    await this.ensureLoaded();
    const all = this.data.topics
      .filter((t) => t.track_id === trackId)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    return all.slice(page * pageSize, page * pageSize + pageSize);
  }

  async createTopic(trackId: string, title: string): Promise<Topic> {
    await this.ensureLoaded();
    const existing = this.data.topics.filter((t) => t.track_id === trackId);
    const topic: Topic = {
      id: newId(),
      track_id: trackId,
      user_id: this.session.email,
      title,
      status: "not_started",
      sort_order: existing.length,
      created_at: nowIso(),
    };
    this.data.topics.push(topic);
    await this.persist();
    return topic;
  }

  async updateTopicStatus(id: string, status: TopicStatus): Promise<void> {
    await this.ensureLoaded();
    const topic = this.data.topics.find((t) => t.id === id);
    if (!topic) return;
    topic.status = status;
    await this.persist();
  }

  async updateTopicTitle(id: string, title: string): Promise<void> {
    await this.ensureLoaded();
    const topic = this.data.topics.find((t) => t.id === id);
    if (!topic) return;
    topic.title = title;
    await this.persist();
  }

  async updateTopicConfidence(id: string, confidence: Confidence | null): Promise<void> {
    await this.ensureLoaded();
    const topic = this.data.topics.find((t) => t.id === id);
    if (!topic) return;
    topic.confidence = confidence;
    await this.persist();
  }

  async deleteTopic(id: string): Promise<void> {
    await this.ensureLoaded();
    this.data.topics = this.data.topics.filter((t) => t.id !== id);
    const removed = new Set(this.data.tasks.filter((t) => t.topic_id === id).map((t) => t.id));
    this.data.tasks = this.data.tasks.filter((t) => t.topic_id !== id);
    this.detachNotes(removed);
    await this.persist();
  }

  async listTasks(topicId: string, page: number, pageSize: number): Promise<Task[]> {
    await this.ensureLoaded();
    const all = this.data.tasks
      .filter((t) => t.topic_id === topicId)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    return all.slice(page * pageSize, page * pageSize + pageSize);
  }

  async createTask(topicId: string, input: CreateTaskInput): Promise<Task> {
    await this.ensureLoaded();
    const topic = this.data.topics.find((t) => t.id === topicId);
    if (!topic) throw new Error("That topic no longer exists.");
    const existing = this.data.tasks.filter((t) => t.topic_id === topicId);
    const task: Task = {
      id: newId(),
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
    this.data.tasks.push(task);
    await this.persist();
    return task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    await this.ensureLoaded();
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.title = input.title;
    task.priority = input.priority;
    task.due_date = input.dueDate;
    if ("recurrence" in input) task.recurrence = input.recurrence ?? null;
    await this.persist();
  }

  async updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void> {
    await this.ensureLoaded();
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if ("dueDate" in input) task.due_date = input.dueDate || null;
    if ("recurrence" in input) task.recurrence = input.recurrence ?? null;
    await this.persist();
  }

  async rescheduleTasks(taskIds: string[], dueDate: string | null): Promise<void> {
    await this.ensureLoaded();
    const wanted = new Set(taskIds);
    for (const task of this.data.tasks) if (wanted.has(task.id)) task.due_date = dueDate;
    await this.persist();
  }

  async importSnapshot(data: Snapshot): Promise<RestoreCounts> {
    await this.ensureLoaded();
    const fresh = remapSnapshot(data, this.session.email, newId);
    this.data.tracks.push(...fresh.tracks);
    this.data.topics.push(...fresh.topics);
    this.data.tasks.push(...fresh.tasks);
    this.data.notes.push(...fresh.notes);
    this.data.cards.push(...fresh.cards);
    this.data.sessions.push(...fresh.sessions);
    await this.persist();
    return {
      tracks: fresh.tracks.length,
      topics: fresh.topics.length,
      tasks: fresh.tasks.length,
      notes: fresh.notes.length,
      cards: fresh.cards.length,
      sessions: fresh.sessions.length,
    };
  }

  async reorderTasks(updates: TaskOrderUpdate[]): Promise<void> {
    await this.ensureLoaded();
    const byId = new Map(this.data.tasks.map((t) => [t.id, t]));
    for (const { id, sort_order } of updates) {
      const task = byId.get(id);
      if (task) task.sort_order = sort_order;
    }
    await this.persist();
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.ensureLoaded();
    this.data.tasks = this.data.tasks.filter((t) => t.id !== taskId);
    this.detachNotes(new Set([taskId]));
    await this.persist();
  }

  async toggleTask(task: Task): Promise<void> {
    await this.ensureLoaded();
    const current = this.data.tasks.find((t) => t.id === task.id);
    if (!current) return;
    current.done = !current.done;
    current.completed_at = current.done ? nowIso() : null;
    this.syncTopicStatus(current.topic_id);
    await this.persist();
  }

  private syncTopicStatus(topicId: string): void {
    const topic = this.data.topics.find((t) => t.id === topicId);
    if (!topic) return;
    const topics = this.data.topics.filter((t) => t.track_id === topic.track_id);
    const tasks = this.data.tasks.filter((t) => t.topic_id === topicId);
    for (const change of topicStatusChanges(topics, tasks, topicId)) {
      const row = topics.find((t) => t.id === change.id);
      if (row) row.status = change.status;
    }
  }

  async moveTask(taskId: string, topicId: string): Promise<void> {
    await this.ensureLoaded();
    const task = this.data.tasks.find((t) => t.id === taskId);
    const target = this.data.topics.find((t) => t.id === topicId);
    if (!task || !target || task.topic_id === topicId) return;
    const sortOrder =
      this.data.tasks.filter((t) => t.topic_id === topicId).reduce((max, t) => Math.max(max, t.sort_order), -1) + 1;
    const from = task.topic_id;
    task.topic_id = topicId;
    task.track_id = target.track_id;
    task.sort_order = sortOrder;
    this.syncTopicStatus(from);
    this.syncTopicStatus(topicId);
    await this.persist();
  }

  // A task's note outlives the task, as a standalone note, and the time
  // spent on it still counts, just no longer tied to anything.
  private detachNotes(taskIds: Set<string>): void {
    for (const note of this.data.notes) {
      if (note.task_id && taskIds.has(note.task_id)) note.task_id = null;
    }
    for (const session of this.data.sessions) {
      if (session.task_id && taskIds.has(session.task_id)) session.task_id = null;
    }
  }

  async listNotes(): Promise<Note[]> {
    await this.ensureLoaded();
    return [...this.data.notes].sort(newestFirst);
  }

  async getNote(id: string): Promise<NoteWithContext | null> {
    await this.ensureLoaded();
    const note = this.data.notes.find((n) => n.id === id);
    if (!note) return null;
    const task = this.data.tasks.find((t) => t.id === note.task_id);
    const topic = task && this.data.topics.find((t) => t.id === task.topic_id);
    const track = task && this.data.tracks.find((t) => t.id === task.track_id);
    return { ...note, context: buildNoteContext(note, task, topic, track) };
  }

  async createNote(input: { title?: string; content?: string } = {}): Promise<Note> {
    await this.ensureLoaded();
    const note = newNote(newId(), this.session.email, nowIso(), input);
    this.data.notes.push(note);
    await this.persist();
    return note;
  }

  async updateNote(id: string, patch: { title?: string; content?: string }): Promise<void> {
    await this.ensureLoaded();
    const note = this.data.notes.find((n) => n.id === id);
    if (!note) return;
    Object.assign(note, patch, { updated_at: nowIso() });
    await this.persist();
  }

  async deleteNote(id: string): Promise<void> {
    await this.ensureLoaded();
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    this.data.cards = this.data.cards.filter((c) => c.note_id !== id);
    await this.persist();
  }

  async listCards(): Promise<Card[]> {
    await this.ensureLoaded();
    return [...this.data.cards];
  }

  async listFocusSessions(): Promise<FocusSession[]> {
    await this.ensureLoaded();
    return [...this.data.sessions];
  }

  async logFocusSession(input: { taskId: string | null; startedAt: string; minutes: number }): Promise<FocusSession> {
    await this.ensureLoaded();
    const session: FocusSession = {
      id: newId(),
      user_id: this.session.email,
      task_id: input.taskId,
      started_at: input.startedAt,
      minutes: input.minutes,
      created_at: nowIso(),
    };
    this.data.sessions.push(session);
    await this.persist();
    return session;
  }

  async syncNoteCards(noteId: string, wanted: { front: string; back: string }[]): Promise<void> {
    await this.ensureLoaded();
    const existing = this.data.cards.filter((c) => c.note_id === noteId);
    const diff = diffCards(existing, wanted);
    if (diff.create.length + diff.updateBack.length + diff.remove.length === 0) return;
    const gone = new Set(diff.remove);
    this.data.cards = this.data.cards.filter((c) => !gone.has(c.id));
    for (const u of diff.updateBack) {
      const card = this.data.cards.find((c) => c.id === u.id);
      if (card) card.back = u.back;
    }
    for (const w of diff.create) {
      this.data.cards.push({
        id: newId(),
        user_id: this.session.email,
        note_id: noteId,
        front: w.front,
        back: w.back,
        ...newCardSchedule(),
        created_at: nowIso(),
      });
    }
    await this.persist();
  }

  async reviewCard(id: string, schedule: CardSchedule): Promise<void> {
    await this.ensureLoaded();
    const card = this.data.cards.find((c) => c.id === id);
    if (!card) return;
    Object.assign(card, schedule);
    await this.persist();
  }

  async getOrCreateTaskNote(taskId: string): Promise<Note | null> {
    await this.ensureLoaded();
    const existing = this.data.notes.find((n) => n.task_id === taskId);
    if (existing) return existing;
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const note = newNote(newId(), this.session.email, nowIso(), { title: task.title, taskId });
    this.data.notes.push(note);
    await this.persist();
    return note;
  }

  async importNotes(notes: ImportedNote[]): Promise<void> {
    await this.ensureLoaded();
    for (const n of notes) this.data.notes.push(newNote(newId(), this.session.email, nowIso(), n));
    if (notes.length > 0) await this.persist();
  }

  async uploadAttachment(file: File, kind: AttachmentKind): Promise<Attachment> {
    await this.ensureLoaded();
    const fileId = await uploadBinaryFile(
      this.session,
      this.folderId!,
      file.name,
      file.type || (kind === "image" ? "image/*" : "audio/*"),
      file,
    );
    return { id: fileId, kind, name: file.name, contentType: file.type };
  }

  async resolveAttachmentUrl(id: string): Promise<string> {
    const cached = this.attachmentUrls.get(id);
    if (cached) return cached;
    const blob = await downloadBinaryFile(this.session, id);
    const url = URL.createObjectURL(blob);
    this.attachmentUrls.set(id, url);
    return url;
  }

  async trackProgress(): Promise<Map<string, TrackProgress>> {
    await this.ensureLoaded();
    return computeTrackProgress(this.data.tasks);
  }

  async topicProgress(trackId: string): Promise<Map<string, TrackProgress>> {
    await this.ensureLoaded();
    return computeTopicProgress(this.data.tasks, trackId);
  }

  async focusTasks(limit: number): Promise<FocusTask[]> {
    await this.ensureLoaded();
    return rankFocusTasks(this.data.tracks, this.data.topics, this.data.tasks, limit);
  }

  async snapshot(options: { notes?: boolean } = {}): Promise<Snapshot> {
    await this.ensureLoaded();
    return {
      tracks: [...this.data.tracks],
      topics: [...this.data.topics],
      tasks: [...this.data.tasks],
      notes: options.notes === false ? [] : [...this.data.notes],
      cards: [...this.data.cards],
      sessions: [...this.data.sessions],
    };
  }

  async importTrack(parsed: ParsedImport): Promise<string> {
    await this.ensureLoaded();
    const track = await this.buildTrack(parsed);
    await this.persist();
    return track.id;
  }

  private async buildTrack(parsed: ParsedImport): Promise<Track> {
    const track: Track = {
      id: newId(),
      user_id: this.session.email,
      name: parsed.trackName,
      description: parsed.description,
      color: null,
      status: "active",
      created_at: nowIso(),
    };
    this.data.tracks.push(track);

    parsed.topics.forEach((topic, topicIndex) => {
      const topicRow: Topic = {
        id: newId(),
        track_id: track.id,
        user_id: this.session.email,
        title: topic.title,
        status: topic.tasks.length > 0 && topic.tasks.every((t) => t.done) ? "done" : "not_started",
        sort_order: topicIndex,
        created_at: nowIso(),
      };
      this.data.topics.push(topicRow);

      topic.tasks.forEach((task, taskIndex) => {
        this.data.tasks.push({
          id: newId(),
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
        });
      });
    });

    return track;
  }
}
