import type { Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "../database.types";
import type { ParsedImport } from "../markdownImport";
import { createDataFile, ensureWaypointFolder, loadDataFile, saveDataFile } from "./driveClient";
import type { GoogleDriveSession } from "./googleAuth";
import { computeTopicProgress, computeTrackProgress, rankFocusTasks } from "./localRanking";
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

const DATA_VERSION = 1;

interface DriveData {
  version: number;
  tracks: Track[];
  topics: Topic[];
  tasks: Task[];
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyData(): DriveData {
  return { version: DATA_VERSION, tracks: [], topics: [], tasks: [] };
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
  readonly supportsReminders = false;

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

  async deleteTopic(id: string): Promise<void> {
    await this.ensureLoaded();
    this.data.topics = this.data.topics.filter((t) => t.id !== id);
    this.data.tasks = this.data.tasks.filter((t) => t.topic_id !== id);
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
      sort_order: existing.length,
      reminder_lead_days: input.dueDate ? (input.reminderLeadDays ?? null) : null,
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
    task.reminder_lead_days = input.dueDate ? input.reminderLeadDays : null;
    await this.persist();
  }

  async updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void> {
    await this.ensureLoaded();
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if ("dueDate" in input) task.due_date = input.dueDate || null;
    if ("reminderLeadDays" in input) task.reminder_lead_days = input.reminderLeadDays ?? null;
    await this.persist();
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.ensureLoaded();
    this.data.tasks = this.data.tasks.filter((t) => t.id !== taskId);
    await this.persist();
  }

  async toggleTask(task: Task): Promise<void> {
    await this.ensureLoaded();
    const current = this.data.tasks.find((t) => t.id === task.id);
    if (!current) return;
    current.done = !current.done;
    current.completed_at = current.done ? nowIso() : null;
    await this.persist();
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
          sort_order: taskIndex,
          reminder_lead_days: null,
          created_at: nowIso(),
        });
      });
    });

    return track;
  }

  async getReminderPrefs(): Promise<ReminderPrefs> {
    return DEFAULT_REMINDER_PREFS;
  }

  async updateReminderPrefs(): Promise<void> {
    // No-op: see supportsReminders — there's no server to act on this
    // while the user is away, on Drive any more than on guest.
  }
}
