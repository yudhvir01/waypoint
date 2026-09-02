import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";

export interface ReminderPrefs {
  user_id: string;
  email_reminders_enabled: boolean;
  push_reminders_enabled: boolean;
}

export function useReminderPrefs() {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["reminderPrefs", session?.user.id],
    enabled: !!client && !!session,
    queryFn: async () => {
      const { data, error } = await client!
        .from("reminder_prefs")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return (
        data ?? {
          user_id: session!.user.id,
          email_reminders_enabled: true,
          push_reminders_enabled: true,
        }
      );
    },
  });
}

export function useUpdateReminderPrefs() {
  const { client, session } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<ReminderPrefs, "email_reminders_enabled" | "push_reminders_enabled">>) => {
      const { error } = await client!
        .from("reminder_prefs")
        .upsert({ user_id: session!.user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminderPrefs"] });
    },
  });
}
