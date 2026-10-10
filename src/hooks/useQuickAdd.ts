import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import { placeQuickAdd, type Placed } from "../lib/inbox";
import { parseQuickAdd } from "../lib/quickAdd";

export interface QuickAddResult extends Placed {
  title: string;
}

export function useQuickAdd() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (text: string): Promise<QuickAddResult> => {
      const parsed = parseQuickAdd(text);
      const placed = await placeQuickAdd(backend!, parsed);
      await backend!.createTask(placed.topicId, {
        title: parsed.title,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        recurrence: parsed.recurrence,
      });
      return { ...placed, title: parsed.title };
    },
    onSuccess: () => {
      for (const key of ["focusNow", "tasks", "trackProgress", "topicProgress", "topics", "tracks", "snapshot"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
