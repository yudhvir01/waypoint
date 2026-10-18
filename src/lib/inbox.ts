import type { Backend } from "./backend/types";
import type { Track } from "./database.types";
import { TODO_NAME } from "./quickAdd";

export { TODO_NAME };

// What the To do track was called before. Found by either name, and
// renamed the first time it's seen.
const OLD_NAME = "Inbox";

export function isTodoTrack(track: Pick<Track, "name"> | null | undefined): boolean {
  const name = track?.name.toLowerCase();
  return name === TODO_NAME.toLowerCase() || name === OLD_NAME.toLowerCase();
}

export function findTodoTrack<T extends Pick<Track, "name">>(tracks: T[] | undefined): T | undefined {
  return tracks?.find((t) => t.name.toLowerCase() === TODO_NAME.toLowerCase()) ?? tracks?.find(isTodoTrack);
}

// Gives an Inbox from an older version its new name. Safe to call often:
// it does nothing once the rename has happened.
export async function renameOldInbox(backend: Backend, tracks: Track[]): Promise<boolean> {
  if (tracks.some((t) => t.name.toLowerCase() === TODO_NAME.toLowerCase())) return false;
  const old = tracks.find((t) => t.name.toLowerCase() === OLD_NAME.toLowerCase());
  if (!old) return false;
  await backend.renameTrack(old.id, TODO_NAME);
  return true;
}

export interface Placed {
  topicId: string;
  trackName: string;
}

// The To do list and its one topic, made the first time they're needed.
// It's a single flat list: the topic is never shown.
export async function ensureTodo(backend: Backend): Promise<{ trackId: string; topicId: string }> {
  const tracks = await backend.listTracks("active");
  await renameOldInbox(backend, tracks);
  let track = findTodoTrack(tracks);
  if (!track) {
    track = await backend.createTrack({ name: TODO_NAME, description: "Things to do, added with + Add a task." });
  }
  const topics = await backend.listTopics(track.id, 0, 100);
  const topic = topics[0] ?? (await backend.createTopic(track.id, TODO_NAME));
  return { trackId: track.id, topicId: topic.id };
}

// Quick-added tasks all go to the To do list.
export async function placeQuickAdd(backend: Backend): Promise<Placed> {
  const { topicId } = await ensureTodo(backend);
  return { topicId, trackName: TODO_NAME };
}
