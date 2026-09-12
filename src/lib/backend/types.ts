import type { Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "../database.types";
import type { ParsedImport } from "../markdownImport";

export interface TrackProgress {
  done: number;
  total: number;
}

export interface FocusTask extends Task {
  topic: {
    id: string;
    title: string;
    track: {
      id: string;
      name: string;
    };
  };
}

export interface ReminderPrefs {
  email_reminders_enabled: boolean;
  push_reminders_enabled: boolean;
  lead_time_days: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  email_reminders_enabled: true,
  push_reminders_enabled: true,
  lead_time_days: 1,
};

export interface CreateTaskInput {
  title: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  reminderLeadDays?: number | null;
}

export interface UpdateTaskInput {
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  reminderLeadDays: number | null;
}

export interface UpdateTaskScheduleInput {
  dueDate?: string | null;
  reminderLeadDays?: number | null;
}

// Every place data can currently live. A Backend is the one seam every
// page and hook talks through — pages never touch Supabase, IndexedDB, or
// (eventually) Drive directly, so adding a fourth place to keep notes
// means writing one new file, not touching every page.
//
// Two things are deliberately *not* part of this interface:
//
//   - Push subscriptions and email reminders. Both need a server to act
//     on your behalf while you're not looking (a cron job, a mail
//     sender) — something a browser-only backend fundamentally can't
//     provide. Gated by `supportsReminders` instead of a no-op
//     implementation, so the UI can explain why rather than pretend a
//     guest toggle does something.
//   - Pagination cursors as anything but a page number. Guest data lives
//     entirely in memory, so "page 3" is just a slice; a future backend
//     with its own cursor shape can still satisfy this by tracking
//     offsets internally.
export interface Backend {
  readonly kind: "supabase" | "guest";

  // Tracks
  listTracks(status: TrackStatus): Promise<Track[]>;
  getTrack(id: string): Promise<Track | null>;
  createTrack(input: { name: string; description?: string | null }): Promise<Track>;
  updateTrackStatus(id: string, status: TrackStatus): Promise<void>;

  // Topics — paginated, page is 0-based.
  listTopics(trackId: string, page: number, pageSize: number): Promise<Topic[]>;
  createTopic(trackId: string, title: string): Promise<Topic>;
  updateTopicStatus(id: string, status: TopicStatus): Promise<void>;
  updateTopicTitle(id: string, title: string): Promise<void>;
  deleteTopic(id: string): Promise<void>;

  // Tasks — paginated, page is 0-based.
  listTasks(topicId: string, page: number, pageSize: number): Promise<Task[]>;
  createTask(topicId: string, input: CreateTaskInput): Promise<Task>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<void>;
  updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  toggleTask(task: Task): Promise<void>;

  // Aggregates
  trackProgress(): Promise<Map<string, TrackProgress>>;
  topicProgress(trackId: string): Promise<Map<string, TrackProgress>>;
  focusTasks(limit: number): Promise<FocusTask[]>;

  // Markdown import — one call, one unit of work, regardless of backend.
  importTrack(parsed: ParsedImport): Promise<string>;

  // Reminders
  readonly supportsReminders: boolean;
  getReminderPrefs(): Promise<ReminderPrefs>;
  updateReminderPrefs(patch: Partial<ReminderPrefs>): Promise<void>;
}
