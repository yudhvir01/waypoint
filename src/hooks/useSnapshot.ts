import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Snapshot } from "../lib/backend/types";

// Reads every row, so it is fetched when a page that needs it opens and
// dropped when it closes (gcTime 0), never held across the app. Mutations
// also invalidate the "snapshot" key.
export function useSnapshot(options: { notes: boolean }) {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["snapshot", options.notes],
    enabled: !!backend,
    staleTime: 0,
    gcTime: 0,
    queryFn: (): Promise<Snapshot> => backend!.snapshot({ notes: options.notes }),
  });
}
