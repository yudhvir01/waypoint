import type { Note, Task, Topic, Track } from "../database.types";
import type { NoteContext } from "./types";

// Shared by the in-memory backends (guest, Drive). Null when the note is
// standalone, or its task/topic/track has since been removed.
export function buildNoteContext(
  note: Note,
  task: Task | undefined,
  topic: Topic | undefined,
  track: Track | undefined,
): NoteContext | null {
  if (!note.task_id || !task || !topic || !track) return null;
  return { trackId: track.id, trackName: track.name, topicTitle: topic.title, taskTitle: task.title };
}

export function newNote(
  id: string,
  userId: string,
  now: string,
  fields: { title?: string; content?: string; taskId?: string | null },
): Note {
  return {
    id,
    user_id: userId,
    task_id: fields.taskId ?? null,
    title: fields.title ?? "",
    content: fields.content ?? "",
    created_at: now,
    updated_at: now,
  };
}

export function newestFirst(a: Note, b: Note): number {
  return b.updated_at.localeCompare(a.updated_at);
}
