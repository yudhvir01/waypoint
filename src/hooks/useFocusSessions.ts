import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";

export function useFocusSessions() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["focusSessions"],
    enabled: !!backend,
    staleTime: 30_000,
    // Older Supabase projects don't have the table yet; once is enough.
    retry: false,
    queryFn: () => backend!.listFocusSessions(),
  });
}

// task id -> minutes of focus ever logged against it.
export function useFocusTotals(): Map<string, number> {
  const { data } = useFocusSessions();
  return useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of data ?? []) {
      if (s.task_id) totals.set(s.task_id, (totals.get(s.task_id) ?? 0) + s.minutes);
    }
    return totals;
  }, [data]);
}
