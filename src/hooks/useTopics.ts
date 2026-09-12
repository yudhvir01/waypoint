import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Topic, TopicStatus } from "../lib/database.types";

// An imported roadmap can be hundreds of topics long, and PostgREST stops
// at 1000 rows, so the track page pages through them.
export const TOPIC_PAGE_SIZE = 100;

export function useTopics(trackId: string | undefined) {
  const { backend } = useBackend();

  return useInfiniteQuery({
    queryKey: ["topics", trackId],
    enabled: !!backend && !!trackId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: Topic[], allPages: Topic[][]) =>
      lastPage.length < TOPIC_PAGE_SIZE ? undefined : allPages.length,
    queryFn: ({ pageParam }) => backend!.listTopics(trackId!, pageParam as number, TOPIC_PAGE_SIZE),
  });
}

export function useCreateTopic(trackId: string) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => backend!.createTopic(trackId, title),
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
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TopicStatus }) =>
      backend!.updateTopicStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
    },
  });
}

export function useUpdateTopicTitle(trackId: string) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => backend!.updateTopicTitle(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
    },
  });
}

export function useDeleteTopic(trackId: string) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => backend!.deleteTopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", trackId] });
      queryClient.invalidateQueries({ queryKey: ["focusNow"] });
      queryClient.invalidateQueries({ queryKey: ["trackProgress"] });
      queryClient.invalidateQueries({ queryKey: ["topicProgress", trackId] });
    },
  });
}
