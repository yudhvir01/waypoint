import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Track, TrackStatus } from "../lib/database.types";
import * as cache from "../lib/cache";
import { useWrite } from "./useWrite";

export function useTracks(status: TrackStatus = "active") {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["tracks", status],
    enabled: !!backend,
    queryFn: () => backend!.listTracks(status),
  });
}

export function useCreateTrack() {
  return useWrite({
    run: (backend, input: { id?: string; name: string; description?: string }): Promise<Track> =>
      backend.createTrack(input),
    show: (qc, input) => {
      input.id ??= crypto.randomUUID();
      cache.addTrack(qc, {
        id: input.id,
        user_id: "",
        name: input.name,
        description: input.description || null,
        color: null,
        status: "active",
        created_at: new Date().toISOString(),
      });
    },
    refresh: ["tracks", "track", "trackProgress"],
  });
}

export function useUpdateTrackStatus() {
  return useWrite({
    run: (backend, { id, status }: { id: string; status: TrackStatus }) => backend.updateTrackStatus(id, status),
    show: (qc, { id, status }) => cache.patchTrack(qc, id, { status }),
    refresh: ["tracks", "track", "trackProgress", "focusNow", "planned"],
  });
}

export function useUpdateTrackDescription() {
  return useWrite({
    run: (backend, { id, description }: { id: string; description: string | null }) =>
      backend.updateTrackDescription(id, description),
    show: (qc, { id, description }) => cache.patchTrack(qc, id, { description }),
    refresh: ["tracks", "track"],
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

export function useDeleteTrack() {
  return useWrite({
    run: (backend, id: string) => backend.deleteTrack(id),
    show: (qc, id) => cache.removeTrack(qc, id),
    refresh: [
      "tracks",
      "track",
      "trackProgress",
      "topicProgress",
      "topics",
      "tasks",
      "focusNow",
      "planned",
      "notes",
      "snapshot",
      "focusSessions",
      "linkIndex",
      "waypoints",
    ],
  });
}
