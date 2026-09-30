export type TrackStatus = "active" | "paused" | "archived";
export type TopicStatus = "not_started" | "in_progress" | "done";
export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Track {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: TrackStatus;
  created_at: string;
}

export interface Topic {
  id: string;
  track_id: string;
  user_id: string;
  title: string;
  status: TopicStatus;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  topic_id: string;
  // Denormalized from the parent topic by the database, never sent by the
  // client. It's what lets Focus Now scan by track.
  track_id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

// A free-form note. `content` is HTML produced by the note editor. A note
// with a task_id is that task's own page of details and learnings; one
// without is a standalone note.
export interface Note {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}
