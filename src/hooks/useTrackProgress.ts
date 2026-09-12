import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { TrackProgress } from "../lib/backend/types";

export type { TrackProgress };

// Done/total per track. On Supabase this is a Postgres aggregate (see
// track_progress() in setup.sql) so the sidebar's "12/40" never costs a
// full table download; on the guest backend it's a pass over an
// in-memory dataset small enough not to matter.
export function useTrackProgress() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["trackProgress"],
    enabled: !!backend,
    queryFn: (): Promise<Map<string, TrackProgress>> => backend!.trackProgress(),
  });
}

// Done/total per topic within one track — one request for the whole track
// instead of one per topic row.
export function useTopicProgress(trackId: string | undefined) {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["topicProgress", trackId],
    enabled: !!backend && !!trackId,
    queryFn: (): Promise<Map<string, TrackProgress>> => backend!.topicProgress(trackId!),
  });
}
