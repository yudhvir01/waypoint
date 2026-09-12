import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Track, TrackStatus } from "../lib/database.types";

export function useTracks(status: TrackStatus = "active") {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["tracks", status],
    enabled: !!backend,
    queryFn: () => backend!.listTracks(status),
  });
}

export function useCreateTrack() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description?: string }): Promise<Track> =>
      backend!.createTrack(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}

export function useUpdateTrackStatus() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TrackStatus }) =>
      backend!.updateTrackStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["track"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
    },
  });
}

export function useTrack(trackId: string | undefined) {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["track", trackId],
    enabled: !!backend && !!trackId,
    queryFn: () => backend!.getTrack(trackId!),
  });
}
