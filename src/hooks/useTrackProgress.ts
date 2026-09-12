import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";

export interface TrackProgress {
  done: number;
  total: number;
}

interface TrackProgressRow {
  track_id: string;
  done: number;
  total: number;
}

// Done/total per track, aggregated by Postgres. This used to select every
// task row the user owned and count them in the browser, which meant the
// sidebar's "12/40" cost a full table download on every page — and, past
// PostgREST's 1000-row response cap, quietly reported the wrong totals.
export function useTrackProgress() {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["trackProgress", session?.user.id],
    enabled: !!client && !!session,
    queryFn: async () => {
      const { data, error } = await client!.rpc("track_progress");
      if (error) throw error;

      const map = new Map<string, TrackProgress>();
      for (const row of (data ?? []) as TrackProgressRow[]) {
        map.set(row.track_id, { done: Number(row.done), total: Number(row.total) });
      }
      return map;
    },
  });
}

// Done/total per topic within one track — one request for the whole track
// instead of one per topic row.
export function useTopicProgress(trackId: string | undefined) {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["topicProgress", trackId],
    enabled: !!client && !!session && !!trackId,
    queryFn: async () => {
      const { data, error } = await client!.rpc("topic_progress", { p_track_id: trackId! });
      if (error) throw error;

      const map = new Map<string, TrackProgress>();
      for (const row of (data ?? []) as { topic_id: string; done: number; total: number }[]) {
        map.set(row.topic_id, { done: Number(row.done), total: Number(row.total) });
      }
      return map;
    },
  });
}
