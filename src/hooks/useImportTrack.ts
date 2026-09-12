import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { ParsedImport } from "../lib/markdownImport";

// On Supabase the whole import runs as one database transaction (see
// import_track in setup.sql); on the guest backend it's a synchronous
// pass over IndexedDB. Either way it's one call, so a failure partway
// through can't leave a half-imported track behind.
export function useImportTrack() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (parsed: ParsedImport): Promise<string> => backend!.importTrack(parsed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    },
  });
}
