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
  remind_me: boolean;
  created_at: string;
}
