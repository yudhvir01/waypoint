import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import * as cache from "../lib/cache";
import { useWrite } from "./useWrite";

export function useWaypoints() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["waypoints"],
    enabled: !!backend,
    staleTime: 30_000,
    // Older Supabase projects don't have the table yet; once is enough.
    retry: false,
    queryFn: () => backend!.listWaypoints(),
  });
}

export function useAddWaypoint() {
  return useWrite({
    run: (backend, input: { id?: string; trackId: string | null; day: string; text: string }) =>
      backend.addWaypoint(input),
    show: (qc, input) => {
      input.id ??= crypto.randomUUID();
      cache.addWaypoint(qc, {
        id: input.id,
        user_id: "",
        track_id: input.trackId,
        day: input.day,
        text: input.text,
        created_at: new Date().toISOString(),
      });
    },
    refresh: ["waypoints"],
  });
}

export function useDeleteWaypoint() {
  return useWrite({
    run: (backend, id: string) => backend.deleteWaypoint(id),
    show: (qc, id) => cache.removeWaypoint(qc, id),
    refresh: ["waypoints"],
  });
}
