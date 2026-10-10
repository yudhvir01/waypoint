import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Confidence, FocusSession, Note, Task, Topic, Track, TrackStatus, TopicStatus } from "../database.types";
import type { ParsedImport } from "../markdownImport";
import { diffCards, newCardSchedule } from "../cards";
import { remapSnapshot } from "./localRestore";
import { topicStatusChanges } from "./localRanking";
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

// Everything a user uploads lives at <userId>/<file>, in the public
// "attachments" bucket setup.sql creates. Storage RLS still restricts
// writes to a user's own folder — see setup.sql — but reads go straight
// through the bucket's public URL rather than the authenticated API, so
// an <img>/<audio> tag can load one without carrying a session token.
const ATTACHMENTS_BUCKET = "attachments";

// Bounds a sidebar listing to something a runaway account can't turn into
// a thousand-row response on every page load. See setup.sql's matching
// index on (user_id, status, created_at).
const TRACK_LIMIT = 500;
// Same idea for the sidebar's notes list.
const NOTE_LIMIT = 500;
// Every card is loaded to work out what's due today.
const CARD_LIMIT = 5000;
// Focus sessions, newest first.
const SESSION_LIMIT = 5000;

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
  recurrence: Task["recurrence"];
  sort_order: number;
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

  async updateTopicConfidence(id: string, confidence: Confidence | null): Promise<void> {
    const { error } = await this.client.from("topics").update({ confidence }).eq("id", id);
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
        recurrence: input.recurrence ?? null,
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
        ...("recurrence" in input ? { recurrence: input.recurrence ?? null } : {}),
      })
      .eq("id", taskId);
    if (error) throw error;
  }

  async updateTaskSchedule(taskId: string, input: UpdateTaskScheduleInput): Promise<void> {
    const patch: Record<string, unknown> = {};
    if ("dueDate" in input) patch.due_date = input.dueDate || null;
    if ("recurrence" in input) patch.recurrence = input.recurrence ?? null;
    const { error } = await this.client.from("tasks").update(patch).eq("id", taskId);
    if (error) throw error;
  }

  async rescheduleTasks(taskIds: string[], dueDate: string | null): Promise<void> {
    // Chunked: the ids travel in the URL, which has a length limit.
    const CHUNK = 100;
    for (let i = 0; i < taskIds.length; i += CHUNK) {
      const { error } = await this.client
        .from("tasks")
        .update({ due_date: dueDate })
        .in("id", taskIds.slice(i, i + CHUNK));
      if (error) throw error;
    }
  }

  // Not one transaction (PostgREST has no multi-statement transactions),
  // so a failure part-way deletes the tracks it already created — topics
  // and tasks go with them by cascade — and the notes it added.
  async importSnapshot(data: Snapshot): Promise<RestoreCounts> {
    const fresh = remapSnapshot(data, this.userId, () => crypto.randomUUID());
    const CHUNK = 500;
    const createdTracks = fresh.tracks.map((t) => t.id);
    const createdNotes = fresh.notes.map((n) => n.id);

    const insertAll = async (table: string, rows: Record<string, unknown>[]) => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await this.client.from(table).insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }
    };

    try {
      await insertAll(
        "tracks",
        fresh.tracks.map((t) => ({
          id: t.id,
          user_id: this.userId,
          name: t.name,
          description: t.description,
          color: t.color,
          status: t.status,
          created_at: t.created_at,
        })),
      );
      await insertAll(
        "topics",
        fresh.topics.map((t) => ({
          id: t.id,
          track_id: t.track_id,
          title: t.title,
          status: t.status,
          confidence: t.confidence ?? null,
          sort_order: t.sort_order,
          created_at: t.created_at,
        })),
      );
      await insertAll(
        "tasks",
        fresh.tasks.map((t) => ({
          id: t.id,
          topic_id: t.topic_id,
          title: t.title,
          done: t.done,
          priority: t.priority,
          due_date: t.due_date,
          completed_at: t.completed_at,
          recurrence: t.recurrence ?? null,
          sort_order: t.sort_order,
          created_at: t.created_at,
        })),
      );
      await insertAll(
        "notes",
        fresh.notes.map((n) => ({
          id: n.id,
          user_id: this.userId,
          task_id: n.task_id,
          title: n.title,
          content: n.content,
          created_at: n.created_at,
          updated_at: n.updated_at,
        })),
      );
      await insertAll(
        "cards",
        fresh.cards.map((c) => ({
          id: c.id,
          user_id: this.userId,
          note_id: c.note_id,
          front: c.front,
          back: c.back,
          due: c.due,
          interval_days: c.interval_days,
          ease: c.ease,
          reps: c.reps,
          lapses: c.lapses,
          last_reviewed_at: c.last_reviewed_at,
          created_at: c.created_at,
        })),
      );
      await insertAll(
        "focus_sessions",
        fresh.sessions.map((x) => ({
          id: x.id,
          user_id: this.userId,
          task_id: x.task_id,
          started_at: x.started_at,
          minutes: x.minutes,
          created_at: x.created_at,
        })),
      );
    } catch (error) {
      for (let i = 0; i < createdTracks.length; i += 100) {
        await this.client.from("tracks").delete().in("id", createdTracks.slice(i, i + 100));
      }
      for (let i = 0; i < createdNotes.length; i += 100) {
        await this.client.from("notes").delete().in("id", createdNotes.slice(i, i + 100));
      }
      throw error;
    }

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
    const results = await Promise.all(
      updates.map(({ id, sort_order }) => this.client.from("tasks").update({ sort_order }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
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
    await this.syncTopicStatus(task.topic_id, task.track_id);
  }

  async moveTask(taskId: string, topicId: string): Promise<void> {
    const { data: task, error: taskError } = await this.client
      .from("tasks")
      .select("topic_id, track_id")
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) throw taskError;
    const { data: target, error: targetError } = await this.client
      .from("topics")
      .select("track_id")
      .eq("id", topicId)
      .maybeSingle();
    if (targetError) throw targetError;
    const from = task as { topic_id: string; track_id: string } | null;
    const to = target as { track_id: string } | null;
    if (!from || !to || from.topic_id === topicId) return;

    const { data: last } = await this.client
      .from("tasks")
      .select("sort_order")
      .eq("topic_id", topicId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

    // The database re-derives the task's track from its new topic.
    const { error } = await this.client
      .from("tasks")
      .update({ topic_id: topicId, sort_order: sortOrder })
      .eq("id", taskId);
    if (error) throw error;
    await this.syncTopicStatus(from.topic_id, from.track_id);
    await this.syncTopicStatus(topicId, to.track_id);
  }

  // Keeps topic status in step with its tasks (see topicStatusChanges).
  // Reads the trigger-maintained counts rather than every task row, so it
  // stays cheap on a topic with thousands of tasks.
  private async syncTopicStatus(topicId: string, trackId: string): Promise<void> {
    const [{ data: counts, error: countError }, { data: topics, error: topicError }] = await Promise.all([
      this.client.from("topic_counts").select("done_count, total_count").eq("topic_id", topicId).maybeSingle(),
      this.client.from("topics").select("*").eq("track_id", trackId),
    ]);
    if (countError) throw countError;
    if (topicError) throw topicError;
    const c = counts as { done_count: number; total_count: number } | null;
    if (!c) return;
    // topicStatusChanges only needs the done/total shape of the tasks.
    const stand = Array.from({ length: c.total_count }, (_, i) => ({ done: i < c.done_count }));
    for (const change of topicStatusChanges((topics ?? []) as Topic[], stand, topicId)) {
      const { error } = await this.client.from("topics").update({ status: change.status }).eq("id", change.id);
      if (error) throw error;
    }
  }

  async listNotes(): Promise<Note[]> {
    const { data, error } = await this.client
      .from("notes")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false })
      .limit(NOTE_LIMIT);
    if (error) throw error;
    return (data ?? []) as Note[];
  }

  async getNote(id: string): Promise<NoteWithContext | null> {
    const { data, error } = await this.client.from("notes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const note = data as Note;
    if (!note.task_id) return { ...note, context: null };

    const { data: task, error: taskError } = await this.client
      .from("tasks")
      .select("title, track_id, topics(title), tracks(name)")
      .eq("id", note.task_id)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) return { ...note, context: null };
    const row = task as unknown as {
      title: string;
      track_id: string;
      topics: { title: string } | null;
      tracks: { name: string } | null;
    };
    return {
      ...note,
      context: {
        trackId: row.track_id,
        trackName: row.tracks?.name ?? "",
        topicTitle: row.topics?.title ?? "",
        taskTitle: row.title,
      },
    };
  }

  async createNote(input: { title?: string; content?: string } = {}): Promise<Note> {
    const { data, error } = await this.client
      .from("notes")
      .insert({ user_id: this.userId, title: input.title ?? "", content: input.content ?? "" })
      .select()
      .single();
    if (error) throw error;
    return data as Note;
  }

  async updateNote(id: string, patch: { title?: string; content?: string }): Promise<void> {
    // updated_at is stamped by a trigger, like every other derived column.
    const { error } = await this.client.from("notes").update(patch).eq("id", id);
    if (error) throw error;
  }

  async deleteNote(id: string): Promise<void> {
    const { error } = await this.client.from("notes").delete().eq("id", id);
    if (error) throw error;
  }

  async listCards(): Promise<Card[]> {
    const { data, error } = await this.client
      .from("cards")
      .select("*")
      .eq("user_id", this.userId)
      .order("due", { ascending: true })
      .limit(CARD_LIMIT);
    if (error) throw error;
    return (data ?? []) as Card[];
  }

  async syncNoteCards(noteId: string, wanted: { front: string; back: string }[]): Promise<void> {
    const { data, error } = await this.client.from("cards").select("id, front, back").eq("note_id", noteId);
    if (error) throw error;
    const diff = diffCards((data ?? []) as Pick<Card, "id" | "front" | "back">[], wanted);

    if (diff.remove.length > 0) {
      const { error: delError } = await this.client.from("cards").delete().in("id", diff.remove);
      if (delError) throw delError;
    }
    for (const u of diff.updateBack) {
      const { error: updError } = await this.client.from("cards").update({ back: u.back }).eq("id", u.id);
      if (updError) throw updError;
    }
    if (diff.create.length > 0) {
      const schedule = newCardSchedule();
      const { error: insError } = await this.client.from("cards").insert(
        diff.create.map((w) => ({ user_id: this.userId, note_id: noteId, front: w.front, back: w.back, ...schedule })),
      );
      if (insError) throw insError;
    }
  }

  async listFocusSessions(): Promise<FocusSession[]> {
    const { data, error } = await this.client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .order("started_at", { ascending: false })
      .limit(SESSION_LIMIT);
    if (error) throw error;
    return (data ?? []) as FocusSession[];
  }

  async logFocusSession(input: { taskId: string | null; startedAt: string; minutes: number }): Promise<FocusSession> {
    const { data, error } = await this.client
      .from("focus_sessions")
      .insert({
        user_id: this.userId,
        task_id: input.taskId,
        started_at: input.startedAt,
        minutes: input.minutes,
      })
      .select()
      .single();
    if (error) throw error;
    return data as FocusSession;
  }

  async reviewCard(id: string, schedule: CardSchedule): Promise<void> {
    const { error } = await this.client.from("cards").update(schedule).eq("id", id);
    if (error) throw error;
  }

  async getOrCreateTaskNote(taskId: string): Promise<Note | null> {
    const { data: existing, error } = await this.client
      .from("notes")
      .select("*")
      .eq("task_id", taskId)
      .maybeSingle();
    if (error) throw error;
    if (existing) return existing as Note;

    const { data: task, error: taskError } = await this.client
      .from("tasks")
      .select("title")
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) return null;

    const { data, error: insertError } = await this.client
      .from("notes")
      .insert({ user_id: this.userId, task_id: taskId, title: (task as { title: string }).title })
      .select()
      .single();
    if (insertError) {
      // Two tabs opening the same task at once: the unique index on
      // task_id makes the loser fail, so read back the winner's row.
      const { data: raced } = await this.client
        .from("notes")
        .select("*")
        .eq("task_id", taskId)
        .maybeSingle();
      if (raced) return raced as Note;
      throw insertError;
    }
    return data as Note;
  }

  async importNotes(notes: ImportedNote[]): Promise<void> {
    if (notes.length === 0) return;
    const { error } = await this.client
      .from("notes")
      .insert(notes.map((n) => ({ user_id: this.userId, title: n.title, content: n.content })));
    if (error) throw error;
  }

  async uploadAttachment(file: File, kind: AttachmentKind): Promise<Attachment> {
    const id = crypto.randomUUID();
    const dot = file.name.lastIndexOf(".");
    const ext = dot >= 0 ? file.name.slice(dot) : "";
    const path = `${this.userId}/${id}${ext}`;
    const { error } = await this.client.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
    return { id: path, kind, name: file.name, contentType: file.type };
  }

  // getPublicUrl only builds a URL string client-side — no request, so
  // nothing to cache.
  async resolveAttachmentUrl(id: string): Promise<string> {
    const { data } = this.client.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(id);
    return data.publicUrl;
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
      recurrence: row.recurrence ?? null,
      sort_order: row.sort_order,
      created_at: row.created_at,
      topic: {
        id: row.topic_id,
        title: row.topic_title,
        track: { id: row.track_id, name: row.track_name },
      },
    }));
  }

  // PostgREST caps a response at 1000 rows, so a whole table is read in
  // pages. The ceiling keeps a runaway account from turning one search
  // into thousands of requests.
  private async fetchAll<T>(table: string, orderBy: string): Promise<T[]> {
    const PAGE = 1000;
    const MAX_ROWS = 50_000;
    const rows: T[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await this.client
        .from(table)
        .select("*")
        .order(orderBy, { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    return rows;
  }

  async snapshot(options: { notes?: boolean } = {}): Promise<Snapshot> {
    const [tracks, topics, tasks, notes, cards, sessions] = await Promise.all([
      this.fetchAll<Track>("tracks", "created_at"),
      this.fetchAll<Topic>("topics", "created_at"),
      this.fetchAll<Task>("tasks", "created_at"),
      options.notes === false ? Promise.resolve([] as Note[]) : this.fetchAll<Note>("notes", "created_at"),
      this.fetchAll<Card>("cards", "created_at"),
      this.fetchAll<FocusSession>("focus_sessions", "created_at"),
    ]);
    return { tracks, topics, tasks, notes, cards, sessions };
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
            recurrence: task.recurrence ?? null,
          })),
        })),
      },
    });
    if (error) throw error;
    return data as string;
  }
}
