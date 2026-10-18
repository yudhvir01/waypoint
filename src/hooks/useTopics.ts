import { useInfiniteQuery } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { FocusTask } from "../lib/backend/types";
import type { Topic, TopicStatus } from "../lib/database.types";
import * as cache from "../lib/cache";
import { useWrite } from "./useWrite";

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
  return useWrite({
    run: (backend, input: { id?: string; title: string }) => backend.createTopic(trackId, input.title, input.id),
    show: (qc, input) => {
      input.id ??= crypto.randomUUID();
      cache.addTopic(qc, {
        id: input.id,
        track_id: trackId,
        user_id: "",
        title: input.title,
        status: "not_started",
        confidence: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      });
    },
    refresh: ["topics", "topicProgress"],
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

export function useUpdateTopicStatus() {
  return useWrite({
    run: (backend, { id, status }: { id: string; status: TopicStatus }) => backend.updateTopicStatus(id, status),
    show: (qc, { id, status }) => cache.patchTopic(qc, id, { status }),
    refresh: ["topics", "focusNow"],
  });
}

export function useUpdateTopicTitle() {
  return useWrite({
    run: (backend, { id, title }: { id: string; title: string }) => backend.updateTopicTitle(id, title),
    show: (qc, { id, title }) => {
      cache.patchTopic(qc, id, { title });
      qc.setQueriesData<FocusTask[]>({ queryKey: ["focusNow"] }, (old) =>
        old?.map((t) => (t.topic.id === id ? { ...t, topic: { ...t.topic, title } } : t)),
      );
    },
    refresh: ["topics", "focusNow", "planned"],
  });
}

export function useDeleteTopic() {
  return useWrite({
    run: (backend, id: string) => backend.deleteTopic(id),
    show: (qc, id) => cache.removeTopic(qc, id),
    refresh: ["topics", "tasks", "focusNow", "planned", "trackProgress", "topicProgress", "snapshot", "notes"],
  });
}
