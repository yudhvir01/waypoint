import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useTrack, useUpdateTrackStatus } from "../hooks/useTracks";
import {
  nextTopicStatus,
  useCreateTopic,
  useTopics,
  useUpdateTopicStatus,
} from "../hooks/useTopics";
import { useCreateTask, useTasks, useToggleTask } from "../hooks/useTasks";
import type { Task, TaskPriority, Topic, TopicStatus } from "../lib/database.types";

const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const TOPIC_STATUS_DOT: Record<TopicStatus, string> = {
  not_started: "bg-muted-foreground",
  in_progress: "bg-primary",
  done: "bg-success",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
  none: "bg-transparent",
};

function NewTaskForm({ topicId }: { topicId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [dueDate, setDueDate] = useState("");
  const createTask = useCreateTask(topicId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask.mutateAsync({ title: title.trim(), priority, dueDate: dueDate || null });
    setTitle("");
    setPriority("none");
    setDueDate("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-6 mt-1 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        + Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ml-6 mt-1 flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-48 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      >
        <option value="none">No priority</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={createTask.isPending}
        className="rounded-md bg-primary px-2 py-1 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-muted-foreground hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}

function TaskRow({ task, topicId }: { task: Task; topicId: string }) {
  const toggleTask = useToggleTask(topicId);

  return (
    <li className="ml-6 flex items-center gap-2.5 py-1.5">
      <button
        type="button"
        onClick={() => toggleTask.mutate(task)}
        aria-label={task.done ? "Mark not done" : "Mark done"}
        className={`h-3.5 w-3.5 shrink-0 rounded-full border border-input ${
          task.done ? "bg-muted-foreground" : ""
        }`}
      />
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
      <span className={`text-[15px] ${task.done ? "text-muted-foreground line-through" : ""}`}>
        {task.title}
      </span>
      {task.due_date && (
        <span className="text-xs text-muted-foreground">
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      )}
    </li>
  );
}

function TopicItem({ topic, trackId }: { topic: Topic; trackId: string }) {
  const { data: tasks } = useTasks(topic.id);
  const updateStatus = useUpdateTopicStatus(trackId);
  const tasksCount = tasks?.length;
  const doneCount = tasks?.filter((t) => t.done).length ?? 0;

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => updateStatus.mutate({ id: topic.id, status: nextTopicStatus(topic.status) })}
          aria-label={`Status: ${TOPIC_STATUS_LABEL[topic.status]}. Click to advance.`}
          title={TOPIC_STATUS_LABEL[topic.status]}
          className="shrink-0 rounded-full p-0.5 transition-opacity hover:opacity-70"
        >
          <span className={`block h-2 w-2 rounded-full ${TOPIC_STATUS_DOT[topic.status]}`} />
        </button>
        <span className="text-[15px] font-medium">{topic.title}</span>
        <span className="flex-1" />
        {!!tasksCount && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {doneCount} / {tasksCount}
          </span>
        )}
      </div>

      {tasks && tasks.length > 0 && (
        <ul className="mt-2.5 flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} topicId={topic.id} />
          ))}
        </ul>
      )}

      <NewTaskForm topicId={topic.id} />
    </div>
  );
}

function NewTopicForm({ trackId }: { trackId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const createTopic = useCreateTopic(trackId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTopic.mutateAsync(title.trim());
    setTitle("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        + New topic
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setOpen(false)}
        placeholder="Topic title (e.g. Pointers)"
        className="w-64 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={createTopic.isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        Add
      </button>
    </form>
  );
}

export function TrackDetail() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { data: track, isLoading: trackLoading } = useTrack(trackId);
  const { data: topics, isLoading: topicsLoading } = useTopics(trackId);
  const updateTrackStatus = useUpdateTrackStatus();

  async function handleArchive() {
    if (!trackId) return;
    await updateTrackStatus.mutateAsync({ id: trackId, status: "archived" });
    navigate("/", { replace: true });
  }

  if (trackLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!track) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Track not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">{track.name}</h1>
        <button
          type="button"
          onClick={handleArchive}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Archive
        </button>
      </div>
      {track.description && (
        <p className="mt-2 text-[15px] text-muted-foreground">{track.description}</p>
      )}

      <hr className="mt-6 border-border" />

      <div className="mt-4">
        {topicsLoading && <p className="text-sm text-muted-foreground">Loading topics…</p>}
        {!topicsLoading && topics?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No topics yet — add one below to start breaking this track down.
          </p>
        )}
        {topics?.map((topic) => (
          <TopicItem key={topic.id} topic={topic} trackId={track.id} />
        ))}
      </div>

      <NewTopicForm trackId={track.id} />
    </AppShell>
  );
}
