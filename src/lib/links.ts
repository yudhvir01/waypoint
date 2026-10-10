import type { Snapshot } from "./backend/types";
import type { Note } from "./database.types";
import { htmlToText } from "./search";

// [[Title]] in a note points at something else by name — another note, a
// task, a topic or a track. "[[Title|shown text]]" is accepted too; only
// the part before the bar is the target.
export const WIKI_LINK_SOURCE = "\\[\\[([^\\[\\]\\n|]{1,200})(?:\\|[^\\[\\]\\n]{0,200})?\\]\\]";

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function linkTitles(html: string): string[] {
  const text = htmlToText(html);
  const rx = new RegExp(WIKI_LINK_SOURCE, "g");
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const m of text.matchAll(rx)) {
    const title = m[1].replace(/\s+/g, " ").trim();
    const key = fold(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
  }
  return titles;
}

export interface LinkTarget {
  kind: "note" | "task" | "topic" | "track";
  id: string;
  label: string;
  // Where the app should go to open it.
  path: string;
}

// A name can match several things; notes win, then tasks, topics, tracks.
// Among notes the most recently edited one wins, among tasks an open one.
export function resolveLink(title: string, index: Snapshot): LinkTarget | null {
  const key = fold(title);
  if (!key) return null;

  const note = index.notes
    .filter((n) => fold(n.title) === key)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (note) return { kind: "note", id: note.id, label: note.title, path: `/notes/${note.id}` };

  const task = index.tasks
    .filter((t) => fold(t.title) === key)
    .sort((a, b) => Number(a.done) - Number(b.done))[0];
  if (task) return { kind: "task", id: task.id, label: task.title, path: `/tasks/${task.id}/note` };

  const topic = index.topics.find((t) => fold(t.title) === key);
  if (topic) {
    return { kind: "topic", id: topic.id, label: topic.title, path: `/tracks/${topic.track_id}?topic=${topic.id}` };
  }

  const track = index.tracks.find((t) => fold(t.name) === key);
  if (track) return { kind: "track", id: track.id, label: track.name, path: `/tracks/${track.id}` };

  return null;
}

export interface Backlink {
  note: Note;
  snippet: string;
}

// Notes that contain a [[link]] to a note with this title.
export function findBacklinks(noteId: string, title: string, notes: Note[]): Backlink[] {
  const key = fold(title);
  if (!key) return [];
  const found: Backlink[] = [];
  for (const note of notes) {
    if (note.id === noteId) continue;
    const text = htmlToText(note.content);
    const rx = new RegExp(WIKI_LINK_SOURCE, "g");
    for (const m of text.matchAll(rx)) {
      if (fold(m[1]) !== key) continue;
      const at = m.index ?? 0;
      const start = Math.max(0, at - 50);
      const end = Math.min(text.length, at + m[0].length + 80);
      found.push({
        note,
        snippet: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
      });
      break;
    }
  }
  return found.sort((a, b) => b.note.updated_at.localeCompare(a.note.updated_at));
}
