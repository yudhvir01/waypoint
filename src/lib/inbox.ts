import type { Backend } from "./backend/types";
import type { Topic, Track } from "./database.types";
import { matchTrack, type QuickAdd } from "./quickAdd";
import { REVIEWS_TOPIC_TITLE } from "./taskActions";

export const INBOX_NAME = "Inbox";

export interface Placed {
  topicId: string;
  trackName: string;
  // Set when a #hint was typed but no track matched it.
  missedHint: string | null;
}

// The topic to put a task in when you just named a track: the one you're
// in the middle of, else the next one, else a plain "Tasks" topic.
function pickTopic(topics: Topic[]): Topic | null {
  const usable = topics.filter((t) => t.title !== REVIEWS_TOPIC_TITLE);
  return (
    usable.find((t) => t.status === "in_progress") ??
    usable.find((t) => t.status === "not_started") ??
    usable[0] ??
    null
  );
}

async function inboxTopic(backend: Backend, tracks: Track[]): Promise<Placed> {
  let track = tracks.find((t) => t.name.toLowerCase() === INBOX_NAME.toLowerCase());
  if (!track) {
    track = await backend.createTrack({
      name: INBOX_NAME,
      description: "Quick-added tasks waiting to be sorted.",
    });
  }
  const topics = await backend.listTopics(track.id, 0, 100);
  const topic = topics[0] ?? (await backend.createTopic(track.id, INBOX_NAME));
  return { topicId: topic.id, trackName: track.name, missedHint: null };
}

export async function placeQuickAdd(backend: Backend, parsed: QuickAdd): Promise<Placed> {
  const tracks = await backend.listTracks("active");
  const match = matchTrack(tracks, parsed.trackHint);
  if (match) {
    const topic = pickTopic(await backend.listTopics(match.id, 0, 100));
    const topicId = topic?.id ?? (await backend.createTopic(match.id, "Tasks")).id;
    return { topicId, trackName: match.name, missedHint: null };
  }
  const placed = await inboxTopic(backend, tracks);
  return { ...placed, missedHint: parsed.trackHint };
}
