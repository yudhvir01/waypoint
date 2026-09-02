import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Track, TrackStatus } from "../lib/database.types";

export function useTracks(status: TrackStatus = "active") {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["tracks", status, session?.user.id],
    enabled: !!client && !!session,
    queryFn: async () => {
      const { data, error } = await client!
        .from("tracks")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Track[];
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
      const { data, error } = await client!
        .from("tracks")
        .select("*")
        .eq("id", trackId!)
        .single();
      if (error) throw error;
      return data as Track;
    },
  });
}
