import { useState } from "react";
import { useTopics } from "../hooks/useTopics";
import { useMoveTask } from "../hooks/useTasks";
import { useTracks } from "../hooks/useTracks";
import type { Task } from "../lib/database.types";

export function MoveTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data: tracks } = useTracks();
  const [trackId, setTrackId] = useState(task.track_id);
  const [topicId, setTopicId] = useState("");
  const { data: topicPages, isLoading } = useTopics(trackId);
  const move = useMoveTask();
  const topics = topicPages?.pages.flat() ?? [];

  // What's chosen: the person's pick if it's in this track, else the
  // first topic that isn't the task's own.
  const chosen =
    topics.find((t) => t.id === topicId) ?? topics.find((t) => t.id !== task.topic_id) ?? topics[0];
  const chosenId = chosen?.id ?? "";

  const unchanged = chosenId === task.topic_id;
  const field =
    "mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">Move task</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{task.title}</p>

        <label className="mt-4 block text-sm">
          Track
          <select
            value={trackId}
            onChange={(e) => {
              setTrackId(e.target.value);
              setTopicId("");
            }}
            className={field}
          >
            {(tracks ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm">
          Topic
          <select value={chosenId} onChange={(e) => setTopicId(e.target.value)} className={field} disabled={isLoading}>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.id === task.topic_id ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        {!isLoading && topics.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">That track has no topics yet.</p>
        )}
        {move.isError && <p className="mt-2 text-xs text-destructive">Couldn't move it. Try again.</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!chosenId || unchanged || move.isPending}
            onClick={() => move.mutate({ taskId: task.id, topicId: chosenId }, { onSuccess: onClose })}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {move.isPending ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
