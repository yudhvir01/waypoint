import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import type { Topic, TopicStatus } from "../lib/database.types";

// An imported roadmap can be hundreds of topics long, and PostgREST stops
// at 1000 rows, so the track page pages through them.
export const TOPIC_PAGE_SIZE = 100;

export function useTopics(trackId: string | undefined) {
  const { client, session } = useSupabase();

  return useInfiniteQuery({
    queryKey: ["topics", trackId],
    enabled: !!client && !!session && !!trackId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: Topic[], allPages: Topic[][]) =>
      lastPage.length < TOPIC_PAGE_SIZE ? undefined : allPages.length,
    queryFn: async ({ pageParam }): Promise<Topic[]> => {
      const from = (pageParam as number) * TOPIC_PAGE_SIZE;
      const { data, error } = await client!
        .from("topics")
        .select("*")
        .eq("track_id", trackId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + TOPIC_PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as Topic[];
    },
  });
}

export function useCreateTopic(trackId: string) {
  const { client } = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await client!
        .from("topics")
        // sort_order is assigned by the database (append to the end of the
        // track), so it stays correct no matter which page is cached.
        .insert({ track_id: trackId, title })
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
      queryClient.invalidateQueries({ queryKey: ["topicProgress", trackId] });
    },
  });
}
