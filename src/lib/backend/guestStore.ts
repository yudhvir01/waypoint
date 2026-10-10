import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Card, Note, Task, Topic, Track } from "../database.types";

// The single local user id stamped onto every row a guest creates. There
// is exactly one guest per browser profile, so this exists only so
// Track/Topic/Task — which otherwise assume a Supabase-issued user_id —
// don't need an optional field just for this backend.
export const GUEST_USER_ID = "guest";

export interface GuestAttachment {
  id: string;
  blob: Blob;
  name: string;
  contentType: string;
}

interface GuestDB extends DBSchema {
  tracks: { key: string; value: Track; indexes: { status: string } };
  topics: { key: string; value: Topic; indexes: { trackId: string } };
  tasks: { key: string; value: Task; indexes: { topicId: string; trackId: string } };
  notes: { key: string; value: Note; indexes: { taskId: string } };
  attachments: { key: string; value: GuestAttachment };
  cards: { key: string; value: Card; indexes: { noteId: string } };
}

let dbPromise: Promise<IDBPDatabase<GuestDB>> | null = null;

export function getGuestDB(): Promise<IDBPDatabase<GuestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GuestDB>("waypoint-guest", 4, {
      upgrade(db, oldVersion) {
        // v3 -> v4 only adds cards; existing stores are untouched.
        if (oldVersion < 4) {
          const cards = db.createObjectStore("cards", { keyPath: "id" });
          cards.createIndex("noteId", "note_id");
        }
        if (oldVersion >= 3) return;
        // v2 -> v3 only adds attachments; existing stores are untouched.
        if (oldVersion < 3) db.createObjectStore("attachments", { keyPath: "id" });
        if (oldVersion >= 2) return;
        const notes = db.createObjectStore("notes", { keyPath: "id" });
        notes.createIndex("taskId", "task_id");
        // v1 -> v2 only adds notes; existing stores are untouched.
        if (oldVersion >= 1) return;
        const tracks = db.createObjectStore("tracks", { keyPath: "id" });
        tracks.createIndex("status", "status");
        const topics = db.createObjectStore("topics", { keyPath: "id" });
        topics.createIndex("trackId", "track_id");
        const tasks = db.createObjectStore("tasks", { keyPath: "id" });
        tasks.createIndex("topicId", "topic_id");
        tasks.createIndex("trackId", "track_id");
      },
    });
  }
  return dbPromise;
}

export function newGuestId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Guest notes live only in this browser's IndexedDB. Without this, a
// browser under storage pressure — or Safari's "no site interaction in 7
// days" rule — can evict it exactly like any other cache, silently. This
// only ever raises the odds of survival; no browser lets a page force
// persistence, so the UI still has to warn people to move their data
// somewhere durable.
export async function requestPersistentGuestStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function hasAnyGuestData(): Promise<boolean> {
  const db = await getGuestDB();
  const [tracks, notes] = await Promise.all([db.count("tracks"), db.count("notes")]);
  return tracks + notes > 0;
}

// Wipes every guest row. Used when someone abandons guest mode for a real
// backend after migrating their data, or explicitly asks to start over.
export async function clearGuestData(): Promise<void> {
  const db = await getGuestDB();
  const tx = db.transaction(["tracks", "topics", "tasks", "notes", "attachments", "cards"], "readwrite");
  await Promise.all([
    tx.objectStore("tracks").clear(),
    tx.objectStore("topics").clear(),
    tx.objectStore("tasks").clear(),
    tx.objectStore("notes").clear(),
    tx.objectStore("attachments").clear(),
    tx.objectStore("cards").clear(),
  ]);
  await tx.done;
}

export type { GuestDB };
