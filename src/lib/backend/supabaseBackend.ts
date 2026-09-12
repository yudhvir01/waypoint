import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, Topic, Track, TrackStatus, TopicStatus } from "../database.types";
import type { ParsedImport } from "../markdownImport";
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

// Bounds a sidebar listing to something a runaway account can't turn into
// a thousand-row response on every page load. See setup.sql's matching
// index on (user_id, status, created_at).
const TRACK_LIMIT = 500;

interface TrackProgressRow {
  track_id: string;
  done: number;
  total: number;
}

interface FocusRow {
  id: string;
  topic_id: string;
  track_id: string;
  title: string;
  done: boolean;
  priority: Task["priority"];
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  reminder_lead_days: number | null;
  created_at: string;
  topic_title: string;
  track_name: string;
}

// Thin wrapper over the Postgres schema in supabase/setup.sql — the
// pagination, aggregation, and atomic-import work all live there, so this
// class is mostly plumbing between the Backend interface's vocabulary and
// PostgREST's.
export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;
  private readonly client: SupabaseClient;
  private readonly userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async listTracks(status: TrackStatus): Promise<Track[]> {
    const { data, error } = await this.client
      .from("tracks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(TRACK_LIMIT);
    if (error) throw error;
    return (data ?? []) as Track[];
  }

  async getTrack(id: string): Promise<Track | null> {
    // maybeSingle, not single: a track that has been deleted or belongs
    // to someone else should read as "not found", not throw.
    const { data, error } = await this.client.from("tracks").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Track) ?? null;
  }

  async createTrack(input: { name: string; description?: string | null }): Promise<Track> {
    const { data, error } = await this.client
      .from("tracks")
      .insert({ user_id: this.userId, name: input.name, description: input.description || null })
      .select()
      .single();
    if (error) throw error;
    return data as Track;
  }

  async updateTrackStatus(id: string, status: TrackStatus): Promise<void> {
    const { error } = await this.client.from("tracks").update({ status }).eq("id", id);
    if (error) throw error;
  }

  async listTopics(trackId: string, page: number, pageSize: number): Promise<Topic[]> {
    const from = page * pageSize;
    const { data, error } = await this.client
      .from("topics")
      .select("*")
      .eq("track_id", trackId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    return (data ?? []) as Topic[];
  }

  async createTopic(trackId: string, title: string): Promise<Topic> {
    const { data, error } = await this.client
      .from("topics")
      // sort_order is assigned by the database (append to the end of the
      // track), so it stays correct no matter which page is cached.
      .insert({ track_id: trackId, title })
      .select()
      .single();
    if (error) throw error;
    return data as Topic;
  }

  async updateTopicStatus(id: string, status: TopicStatus): Promise<void> {
    const { error } = await this.client.from("topics").update({ status }).eq("id", id);
    if (error) throw error;
  }

  async updateTopicTitle(id: string, title: string): Promise<void> {
    const { error } = await this.client.from("topics").update({ title }).eq("id", id);
    if (error) throw error;
  }

  async deleteTopic(id: string): Promise<void> {
    const { error } = await this.client.from("topics").delete().eq("id", id);
    if (error) throw error;
  }

  async listTasks(topicId: string, page: number, pageSize: number): Promise<Task[]> {
    const from = page * pageSize;
    const { data, error } = await this.client
      .from("tasks")
      .select("*")
      .eq("topic_id", topicId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    return (data ?? []) as Task[];
  }

  async createTask(topicId: string, input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.client
      .from("tasks")
      .insert({
        topic_id: topicId,
        title: input.title,
        priority: input.priority ?? "none",
        due_date: input.dueDate || null,
        // A reminder needs a date to count backwards from.
        reminder_lead_days: input.dueDate ? (input.reminderLeadDays ?? null) : null,
        // sort_order is left to the database, which appends to the end
        // of the topic.
      })
      .select()
      .single();
    if (error) throw error;
    return data as Task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    const { error } = await this.client
      .from("tasks")
      .update({
        title: input.title,
        priority: input.priority,
        due_date: input.dueDate,
        reminder_lead_days: input.dueDate ? input.reminderLeadDays : null,
      })
      .eq("id", taskId);
    if (error) throw error;
  }

  async updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void> {
    const patch: Record<string, unknown> = {};
    if ("dueDate" in input) patch.due_date = input.dueDate || null;
    if ("reminderLeadDays" in input) patch.reminder_lead_days = input.reminderLeadDays;
    const { error } = await this.client.from("tasks").update(patch).eq("id", taskId);
    if (error) throw error;
  }

  async deleteTask(taskId: string): Promise<void> {
    const { error } = await this.client.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
  }

  async toggleTask(task: Task): Promise<void> {
    // completed_at is stamped by the database from `done`, so the two
    // can never disagree.
    const { error } = await this.client.from("tasks").update({ done: !task.done }).eq("id", task.id);
    if (error) throw error;
  }

  async trackProgress(): Promise<Map<string, TrackProgress>> {
    const { data, error } = await this.client.rpc("track_progress");
    if (error) throw error;
    const map = new Map<string, TrackProgress>();
    for (const row of (data ?? []) as TrackProgressRow[]) {
      map.set(row.track_id, { done: Number(row.done), total: Number(row.total) });
    }
    return map;
  }

  async topicProgress(trackId: string): Promise<Map<string, TrackProgress>> {
    const { data, error } = await this.client.rpc("topic_progress", { p_track_id: trackId });
    if (error) throw error;
    const map = new Map<string, TrackProgress>();
    for (const row of (data ?? []) as { topic_id: string; done: number; total: number }[]) {
      map.set(row.topic_id, { done: Number(row.done), total: Number(row.total) });
    }
    return map;
  }

  async focusTasks(limit: number): Promise<FocusTask[]> {
    const { data, error } = await this.client.rpc("focus_tasks", { p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as FocusRow[]).map((row) => ({
      id: row.id,
      topic_id: row.topic_id,
      track_id: row.track_id,
      title: row.title,
      done: row.done,
      priority: row.priority,
      due_date: row.due_date,
      completed_at: row.completed_at,
      sort_order: row.sort_order,
      reminder_lead_days: row.reminder_lead_days,
      created_at: row.created_at,
      topic: {
        id: row.topic_id,
        title: row.topic_title,
        track: { id: row.track_id, name: row.track_name },
      },
    }));
  }

  async importTrack(parsed: ParsedImport): Promise<string> {
    const { data, error } = await this.client.rpc("import_track", {
      payload: {
        trackName: parsed.trackName,
        description: parsed.description,
        topics: parsed.topics.map((topic) => ({
          title: topic.title,
          tasks: topic.tasks.map((task) => ({
            title: task.title,
            done: task.done,
            priority: task.priority,
            dueDate: task.dueDate,
          })),
        })),
      },
    });
    if (error) throw error;
    return data as string;
  }

  readonly supportsReminders = true;

  async getReminderPrefs(): Promise<ReminderPrefs> {
    const { data, error } = await this.client
      .from("reminder_prefs")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? (data as ReminderPrefs) : DEFAULT_REMINDER_PREFS;
  }

  async updateReminderPrefs(patch: Partial<ReminderPrefs>): Promise<void> {
    const { error } = await this.client
      .from("reminder_prefs")
      .upsert({ user_id: this.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
  }
}
