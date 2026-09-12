import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { ReminderPrefs } from "../lib/backend/types";

export type { ReminderPrefs };

export function useReminderPrefs() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["reminderPrefs"],
    enabled: !!backend,
    queryFn: (): Promise<ReminderPrefs> => backend!.getReminderPrefs(),
  });
}

export function useUpdateReminderPrefs() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<ReminderPrefs>) => backend!.updateReminderPrefs(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminderPrefs"] });
    },
  });
}
