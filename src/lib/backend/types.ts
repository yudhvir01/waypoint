import type { Note, Task, TaskPriority, Topic, TopicStatus, Track, TrackStatus } from "../database.types";
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

// Where a task's note lives, for the "back to" breadcrumb on its page.
export interface NoteContext {
  trackId: string;
  trackName: string;
  topicTitle: string;
  taskTitle: string;
}

export interface NoteWithContext extends Note {
  context: NoteContext | null;
}

export interface ImportedNote {
  title: string;
  content: string;
}

export interface CreateTaskInput {
  title: string;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface UpdateTaskScheduleInput {
  dueDate?: string | null;
}

// Every place data can currently live. A Backend is the one seam every
// page and hook talks through — pages never touch Supabase, IndexedDB, or
// (eventually) Drive directly, so adding a fourth place to keep notes
// means writing one new file, not touching every page.
//
// One thing is deliberately *not* part of this interface: pagination
// cursors as anything but a page number. Guest data lives entirely in
// memory, so "page 3" is just a slice; a future backend with its own
// cursor shape can still satisfy this by tracking offsets internally.
export interface Backend {
  readonly kind: "supabase" | "guest" | "drive";

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

  // Notes
  listNotes(): Promise<Note[]>;
  getNote(id: string): Promise<NoteWithContext | null>;
  createNote(input?: { title?: string; content?: string }): Promise<Note>;
  updateNote(id: string, patch: { title?: string; content?: string }): Promise<void>;
  deleteNote(id: string): Promise<void>;
  // The note attached to a task, created (titled with the task) the first
  // time the task is opened. Returns null if the task no longer exists.
  getOrCreateTaskNote(taskId: string): Promise<Note | null>;
  importNotes(notes: ImportedNote[]): Promise<void>;

  // Aggregates
  trackProgress(): Promise<Map<string, TrackProgress>>;
  topicProgress(trackId: string): Promise<Map<string, TrackProgress>>;
  focusTasks(limit: number): Promise<FocusTask[]>;

  // Markdown import — one call, one unit of work, regardless of backend.
  importTrack(parsed: ParsedImport): Promise<string>;
}
