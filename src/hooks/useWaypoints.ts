import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";

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
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { trackId: string | null; day: string; text: string }) => backend!.addWaypoint(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waypoints"] }),
  });
}

export function useDeleteWaypoint() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => backend!.deleteWaypoint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waypoints"] }),
  });
}
