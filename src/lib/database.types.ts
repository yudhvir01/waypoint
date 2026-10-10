export type TrackStatus = "active" | "paused" | "archived";
export type TopicStatus = "not_started" | "in_progress" | "done";
export type TaskPriority = "none" | "low" | "medium" | "high";
// How well you feel you know a topic — your own call, not a quiz score.
export type Confidence = "shaky" | "okay" | "solid";
export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly";

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
  // Absent on rows written before confidence existed; read as `?? null`.
  confidence?: Confidence | null;
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
  // How the task repeats once it's ticked off. Rows written before
  // recurrence existed simply lack the field, so read it as `?? null`.
  recurrence?: Recurrence | null;
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

// A flashcard. Cards are derived from notes: a line written as
// "question :: answer" becomes one, and the scheduling fields below track
// when it is next due.
export interface Card {
  id: string;
  user_id: string;
  note_id: string | null;
  front: string;
  back: string;
  // YYYY-MM-DD, local calendar day.
  due: string;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
  created_at: string;
}
