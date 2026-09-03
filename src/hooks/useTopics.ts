import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Topic, TopicStatus } from "../lib/database.types";

export function useTopics(trackId: string | undefined) {
  const { client, session } = useSupabase();

  return useQuery({
    queryKey: ["topics", trackId],
    enabled: !!client && !!session && !!trackId,
    queryFn: async () => {
      const { data, error } = await client!
        .from("topics")
        .select("*")
        .eq("track_id", trackId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Topic[];
    },
  });
}

export function useCreateTopic(trackId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      const existing = queryClient.getQueryData<Topic[]>(["topics", trackId]) ?? [];
      const { data, error } = await client!
        .from("topics")
        .insert({ track_id: trackId, title, sort_order: existing.length })
        .select()
        .single();
      if (error) throw error;
      return data as Topic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
    },
  });
}

const STATUS_CYCLE: Record<TopicStatus, TopicStatus> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

export function nextTopicStatus(status: TopicStatus): TopicStatus {
  return STATUS_CYCLE[status];
}

export function useUpdateTopicStatus(trackId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TopicStatus }) => {
      const { error } = await client!.from("topics").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
    },
  });
}

export function useUpdateTopicTitle(trackId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await client!.from("topics").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
    },
  });
}

export function useDeleteTopic(trackId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client!.from("topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
    },
  });
}
