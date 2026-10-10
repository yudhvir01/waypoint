import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Snapshot } from "../lib/backend/types";

// Everything a [[link]] can point at, plus every note's text (for
// backlinks). Kept for a short while so moving between linked notes
// doesn't re-read the whole account each time.
export function useLinkIndex() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["linkIndex"],
    enabled: !!backend,
    staleTime: 30_000,
    gcTime: 60_000,
    queryFn: (): Promise<Snapshot> => backend!.snapshot({ notes: true }),
  });
}
