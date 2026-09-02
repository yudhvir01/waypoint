import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { ParsedImport } from "../lib/markdownImport";

export function useImportTrack() {
  const { client, session } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (parsed: ParsedImport) => {
      const { data: track, error: trackError } = await client!
        .from("tracks")
        .insert({
          user_id: session!.user.id,
          name: parsed.trackName,
          description: parsed.description,
        })
        .select()
        .single();
      if (trackError) throw trackError;

      for (const [topicIndex, topic] of parsed.topics.entries()) {
        const { data: topicRow, error: topicError } = await client!
          .from("topics")
          .insert({
            track_id: track.id,
            title: topic.title,
            sort_order: topicIndex,
            status: topic.tasks.length > 0 && topic.tasks.every((t) => t.done) ? "done" : "not_started",
          })
          .select()
          .single();
        if (topicError) throw topicError;

        if (topic.tasks.length === 0) continue;

        const { error: tasksError } = await client!.from("tasks").insert(
          topic.tasks.map((task, taskIndex) => ({
            topic_id: topicRow.id,
            title: task.title,
            done: task.done,
            priority: task.priority,
            due_date: task.dueDate,
            completed_at: task.done ? new Date().toISOString() : null,
            sort_order: taskIndex,
          })),
        );
        if (tasksError) throw tasksError;
      }

      return track;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
    },
  });
}
