import type { Snapshot } from "./backend/types";
import type { Note, Task, Topic, Track } from "./database.types";

export interface TaskHit {
  kind: "task";
  task: Task;
  topic: Topic | undefined;
  track: Track | undefined;
  score: number;
}
export interface TopicHit {
  kind: "topic";
  topic: Topic;
  track: Track | undefined;
  score: number;
}
export interface TrackHit {
  kind: "track";
  track: Track;
  score: number;
}
export interface NoteHit {
  kind: "note";
  note: Note;
  snippet: string;
  score: number;
}

export interface SearchResults {
  tracks: TrackHit[];
  topics: TopicHit[];
  tasks: TaskHit[];
  notes: NoteHit[];
  total: number;
}

const PER_GROUP = 40;

// Case- and accent-insensitive ("café" matches "cafe").
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

// Every term has to appear (AND). Earlier, whole-word and prefix matches
// score higher than a substring buried mid-word.
function scoreText(haystack: string, terms: string[]): number {
  let total = 0;
  for (const term of terms) {
    const at = haystack.indexOf(term);
    if (at < 0) return 0;
    const boundary = at === 0 || /[^\p{L}\p{N}]/u.test(haystack[at - 1]);
    total += boundary ? (at === 0 ? 30 : 20) : 8;
  }
  // Shorter text that matches is a tighter match.
  return total + Math.max(0, 10 - Math.floor(haystack.length / 20));
}

function snippetAround(text: string, terms: string[]): string {
  const folded = fold(text);
  let at = -1;
  for (const term of terms) {
    const i = folded.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, 140);
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + 100);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function searchSnapshot(snapshot: Snapshot, query: string): SearchResults {
  const terms = tokenize(query);
  const empty: SearchResults = { tracks: [], topics: [], tasks: [], notes: [], total: 0 };
  if (terms.length === 0) return empty;

  const trackById = new Map(snapshot.tracks.map((t) => [t.id, t]));
  const topicById = new Map(snapshot.topics.map((t) => [t.id, t]));

  const tracks: TrackHit[] = [];
  for (const track of snapshot.tracks) {
    const score = scoreText(fold(`${track.name} ${track.description ?? ""}`), terms);
    if (score > 0) tracks.push({ kind: "track", track, score });
  }

  const topics: TopicHit[] = [];
  for (const topic of snapshot.topics) {
    const score = scoreText(fold(topic.title), terms);
    if (score > 0) topics.push({ kind: "topic", topic, track: trackById.get(topic.track_id), score });
  }

  const tasks: TaskHit[] = [];
  for (const task of snapshot.tasks) {
    let score = scoreText(fold(task.title), terms);
    if (score === 0) continue;
    // Open work is usually what you're hunting for.
    if (!task.done) score += 5;
    tasks.push({
      kind: "task",
      task,
      topic: topicById.get(task.topic_id),
      track: trackById.get(task.track_id),
      score,
    });
  }

  const notes: NoteHit[] = [];
  for (const note of snapshot.notes) {
    const body = htmlToText(note.content);
    const titleScore = scoreText(fold(note.title), terms);
    const bodyScore = scoreText(fold(`${note.title} ${body}`), terms);
    if (bodyScore === 0) continue;
    notes.push({
      kind: "note",
      note,
      snippet: snippetAround(body, terms),
      score: Math.max(titleScore * 1.5, bodyScore),
    });
  }

  const byScore = <T extends { score: number }>(list: T[]) =>
    list.sort((a, b) => b.score - a.score).slice(0, PER_GROUP);
  const result = {
    tracks: byScore(tracks),
    topics: byScore(topics),
    tasks: byScore(tasks),
    notes: byScore(notes),
    total: 0,
  };
  result.total = result.tracks.length + result.topics.length + result.tasks.length + result.notes.length;
  return result;
}
