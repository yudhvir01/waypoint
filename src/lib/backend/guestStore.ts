import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Task, Topic, Track } from "../database.types";

// The single local user id stamped onto every row a guest creates. There
// is exactly one guest per browser profile, so this exists only so
// Track/Topic/Task — which otherwise assume a Supabase-issued user_id —
// don't need an optional field just for this backend.
export const GUEST_USER_ID = "guest";

interface GuestDB extends DBSchema {
  tracks: { key: string; value: Track; indexes: { status: string } };
  topics: { key: string; value: Topic; indexes: { trackId: string } };
  tasks: { key: string; value: Task; indexes: { topicId: string; trackId: string } };
}

let dbPromise: Promise<IDBPDatabase<GuestDB>> | null = null;

export function getGuestDB(): Promise<IDBPDatabase<GuestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GuestDB>("waypoint-guest", 1, {
      upgrade(db) {
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
  const count = await db.count("tracks");
  return count > 0;
}

// Wipes every guest row. Used when someone abandons guest mode for a real
// backend after migrating their data, or explicitly asks to start over.
export async function clearGuestData(): Promise<void> {
  const db = await getGuestDB();
  const tx = db.transaction(["tracks", "topics", "tasks"], "readwrite");
  await Promise.all([tx.objectStore("tracks").clear(), tx.objectStore("topics").clear(), tx.objectStore("tasks").clear()]);
  await tx.done;
}

export type { GuestDB };
