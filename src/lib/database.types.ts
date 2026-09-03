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
  title: string;
  status: TopicStatus;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  topic_id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  reminder_lead_days: number | null;
  created_at: string;
}

// Shared "days before due date" options for reminder pickers.
export const REMINDER_LEAD_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "On the due date" },
  { value: 1, label: "1 day before" },
  { value: 2, label: "2 days before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "1 week before" },
];
