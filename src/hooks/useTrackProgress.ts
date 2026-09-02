import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";

export interface TrackProgress {
  done: number;
  total: number;
}

export function useTrackProgress() {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["trackProgress", session?.user.id],
    enabled: !!client && !!session,
    queryFn: async () => {
      const { data, error } = await client!
        .from("tasks")
        .select("done, topic:topics!inner(track:tracks!inner(id, status))");
      if (error) throw error;

      const rows = data as unknown as {
        done: boolean;
        topic: { track: { id: string; status: string } };
      }[];

      const map = new Map<string, TrackProgress>();
      for (const row of rows) {
        if (row.topic.track.status !== "active") continue;
        const trackId = row.topic.track.id;
        const entry = map.get(trackId) ?? { done: 0, total: 0 };
        entry.total += 1;
        if (row.done) entry.done += 1;
        map.set(trackId, entry);
      }
      return map;
    },
  });
}
