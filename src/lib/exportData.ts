import type { Snapshot } from "./backend/types";
import type { Task, Topic, Track } from "./database.types";
import { toDateKey } from "./recurrence";

// The inverse of markdownImport.ts: what this writes, "Import Markdown"
// reads back into an identical track (titles, order, done state,
// priority, deadline, repeat).
export function trackToMarkdown(track: Track, topics: Topic[], tasks: Task[]): string {
  const lines: string[] = [`# ${track.name}`];
  if (track.description) lines.push("", `> ${track.description.replace(/\s+/g, " ")}`);

  const sortedTopics = topics
    .filter((t) => t.track_id === track.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  for (const topic of sortedTopics) {
    const topicTasks = tasks
      .filter((t) => t.topic_id === topic.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    // The importer drops topics with no tasks, so there's no point
    // writing them.
    if (topicTasks.length === 0) continue;
    lines.push("", `## ${topic.title}`, "");
    for (const task of topicTasks) {
      const tags: string[] = [];
      if (task.priority !== "none") tags.push(`#priority:${task.priority}`);
      if (task.due_date) tags.push(`#due:${task.due_date}`);
      if (task.recurrence) tags.push(`#repeat:${task.recurrence}`);
      lines.push(`- [${task.done ? "x" : " "}] ${[task.title, ...tags].join(" ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function snapshotToBackupJson(snapshot: Snapshot): string {
  return JSON.stringify(
    {
      app: "waypoint",
      version: 1,
      exportedAt: new Date().toISOString(),
      // Images and audio embedded in notes are referenced by id and are
      // not part of this file.
      tracks: snapshot.tracks,
      topics: snapshot.topics,
      tasks: snapshot.tasks,
      notes: snapshot.notes,
      cards: snapshot.cards,
    },
    null,
    2,
  );
}

export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "waypoint";
}

export function downloadTextFile(fileName: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on a delay so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function backupFileName(): string {
  return `waypoint-backup-${toDateKey(new Date())}.json`;
}
