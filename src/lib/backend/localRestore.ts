import type { Snapshot } from "./types";

// Re-issues every row in a backup under a fresh id and owner, rewiring
// the references between them. Rows whose parent isn't in the file (a
// topic with no track, say) are dropped; a note whose task is missing
// just becomes a standalone note.
//
// Fresh ids rather than the file's own: restoring into an account that
// already holds the same data adds a second copy instead of failing on
// duplicate keys — or, on Supabase, colliding with a row another account
// owns.
export function remapSnapshot(data: Snapshot, userId: string, newId: () => string): Snapshot {
  const trackIds = new Map<string, string>();
  const topicIds = new Map<string, string>();
  const taskIds = new Map<string, string>();
  // new topic id -> new track id, so tasks can find their track in O(1).
  const trackOfTopic = new Map<string, string>();

  const tracks = data.tracks.map((t) => {
    const id = newId();
    trackIds.set(t.id, id);
    return { ...t, id, user_id: userId };
  });

  const topics = data.topics.flatMap((t) => {
    const trackId = trackIds.get(t.track_id);
    if (!trackId) return [];
    const id = newId();
    topicIds.set(t.id, id);
    trackOfTopic.set(id, trackId);
    return [{ ...t, id, track_id: trackId, user_id: userId }];
  });

  const tasks = data.tasks.flatMap((t) => {
    const topicId = topicIds.get(t.topic_id);
    const trackId = topicId ? trackOfTopic.get(topicId) : undefined;
    if (!topicId || !trackId) return [];
    const id = newId();
    taskIds.set(t.id, id);
    return [{ ...t, id, topic_id: topicId, track_id: trackId }];
  });

  const notes = data.notes.map((n) => ({
    ...n,
    id: newId(),
    user_id: userId,
    task_id: n.task_id ? (taskIds.get(n.task_id) ?? null) : null,
  }));

  return { tracks, topics, tasks, notes };
}
