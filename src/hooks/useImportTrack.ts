import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { ParsedImport } from "../lib/markdownImport";

// The whole import runs as one database transaction (see import_track in
// setup.sql). It used to be a request per topic from the browser: a large
// roadmap took hundreds of round trips, and a failure partway through
// left a half-imported track behind with no way to tell how far it got.
export function useImportTrack() {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (parsed: ParsedImport): Promise<string> => {
      const { data, error } = await client!.rpc("import_track", {
        payload: {
          trackName: parsed.trackName,
          description: parsed.description,
          topics: parsed.topics.map((topic) => ({
            title: topic.title,
            tasks: topic.tasks.map((task) => ({
              title: task.title,
              done: task.done,
              priority: task.priority,
              dueDate: task.dueDate,
            })),
          })),
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    },
  });
}
