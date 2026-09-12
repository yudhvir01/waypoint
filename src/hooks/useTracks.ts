import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Track, TrackStatus } from "../lib/database.types";

// The sidebar lists tracks in full, so this is deliberately unpaginated —
// but it is still bounded, because a runaway account shouldn't be able to
// turn every page load into a thousand-row response. The explicit user_id
// filter matches the (user_id, status, created_at) index; relying on RLS
// alone leaves the planner to infer it.
export const TRACK_LIMIT = 500;

export function useTracks(status: TrackStatus = "active") {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["tracks", status, session?.user.id],
    enabled: !!client && !!session,
    queryFn: async () => {
      const { data, error } = await client!
        .from("tracks")
        .select("*")
        .eq("user_id", session!.user.id)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(TRACK_LIMIT);
      if (error) throw error;
      return (data ?? []) as Track[];
    },
  });
}

export function useCreateTrack() {
  const { client, session } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data, error } = await client!
        .from("tracks")
        .insert({
          user_id: session!.user.id,
          name: input.name,
          description: input.description || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Track;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}

export function useUpdateTrackStatus() {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TrackStatus }) => {
      const { error } = await client!.from("tracks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["track"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
    },
  });
}

export function useTrack(trackId: string | undefined) {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["track", trackId],
    enabled: !!client && !!session && !!trackId,
    queryFn: async () => {
      // maybeSingle, not single: a track that has been deleted or that
      // belongs to someone else should render "not found", not an error.
      const { data, error } = await client!
        .from("tracks")
        .select("*")
        .eq("id", trackId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Track) ?? null;
    },
  });
}
