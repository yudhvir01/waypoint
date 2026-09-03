import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SchedulePopover } from "../components/SchedulePopover";
import { ActionMenu } from "../components/ActionMenu";
import { useTrack, useUpdateTrackStatus } from "../hooks/useTracks";
import { useTrackProgress } from "../hooks/useTrackProgress";
import {
  nextTopicStatus,
  useCreateTopic,
  useDeleteTopic,
  useTopics,
  useUpdateTopicStatus,
  useUpdateTopicTitle,
} from "../hooks/useTopics";
import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
  useUpdateTaskSchedule,
  useToggleTask,
} from "../hooks/useTasks";
import {
  REMINDER_LEAD_OPTIONS,
  type Task,
  type TaskPriority,
  type Topic,
  type TopicStatus,
} from "../lib/database.types";

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.5c-2 0-3.2 1.6-3.2 3.6v2c0 .7-.3 1.4-.8 1.9l-.5.5c-.4.4-.1 1 .4 1h8.2c.5 0 .8-.6.4-1l-.5-.5c-.5-.5-.8-1.2-.8-1.9v-2c0-2-1.2-3.6-3.2-3.6Z" />
      <path d="M6.3 12.5a1.7 1.7 0 0 0 3.4 0" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12" />
      <path d="M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
    >
      <path d="M5 2.5 11 8 5 13.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.5 12.3l-2.8.7.7-2.8Z" />
    </svg>
  );
}

function reminderLeadLabel(days: number): string {
  return REMINDER_LEAD_OPTIONS.find((o) => o.value === days)?.label ?? `${days}d before`;
}

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

interface TaskFormValues {
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  reminderLeadDays: number | null;
}

// Shared by "Add task" and "Edit task" — same compact row, same fields,
// the only difference is whether `initial` is populated.
function TaskForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: TaskFormValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "none");
  const [dueDate, setDueDate] = useState<string | null>(initial?.dueDate ?? null);
  const [reminderLeadDays, setReminderLeadDays] = useState<number | null>(
    initial?.reminderLeadDays ?? null,
  );
  const [popover, setPopover] = useState<"date" | "reminder" | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), priority, dueDate, reminderLeadDays });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-input bg-background px-1.5 py-1.5 text-xs text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        >
          <option value="none">No priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          type="button"
          onClick={() => setPopover("date")}
          title={dueDate ? new Date(dueDate).toLocaleDateString() : "Set a deadline"}
          className={`shrink-0 rounded p-1.5 transition-colors ${
            dueDate ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
          }`}
        >
          <CalendarIcon />
        </button>
        <button
          type="button"
          onClick={() => setPopover("reminder")}
          title={reminderLeadDays !== null ? "Reminder set" : "Set a reminder"}
          className={`shrink-0 rounded p-1.5 transition-colors ${
            reminderLeadDays !== null
              ? "text-teal"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          }`}
        >
          <BellIcon filled={reminderLeadDays !== null} />
        </button>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-xs text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </form>

      {popover && (
        <SchedulePopover
          variant={popover}
          currentDueDate={dueDate}
          currentReminderLeadDays={reminderLeadDays}
          onClose={() => setPopover(null)}
          onSave={(patch) => {
            if ("dueDate" in patch) setDueDate(patch.dueDate ?? null);
            if ("reminderLeadDays" in patch) setReminderLeadDays(patch.reminderLeadDays ?? null);
          }}
        />
      )}
    </>
  );
}

function NewTaskForm({ topicId }: { topicId: string }) {
  const [open, setOpen] = useState(false);
  const createTask = useCreateTask(topicId);

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
    <div className="ml-6 mt-1">
      <TaskForm
        submitLabel="+"
        pending={createTask.isPending}
        onCancel={() => setOpen(false)}
        onSubmit={async (values) => {
          await createTask.mutateAsync(values);
          setOpen(false);
        }}
      />
    </div>
  );
}

function TaskRow({ task, topicId }: { task: Task; topicId: string }) {
  const toggleTask = useToggleTask(topicId);
  const updateSchedule = useUpdateTaskSchedule(topicId);
  const updateTask = useUpdateTask(topicId);
  const deleteTask = useDeleteTask(topicId);
  const [popover, setPopover] = useState(false);
  const [menuPopover, setMenuPopover] = useState<"date" | "reminder" | null>(null);
  const [editing, setEditing] = useState(false);
  const hasReminder = task.reminder_lead_days !== null;

  if (editing) {
    return (
      <li className="ml-6 py-1">
        <TaskForm
          submitLabel="Save"
          pending={updateTask.isPending}
          initial={{
            title: task.title,
            priority: task.priority,
            dueDate: task.due_date,
            reminderLeadDays: task.reminder_lead_days,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await updateTask.mutateAsync({ taskId: task.id, ...values });
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="group ml-6 flex items-center gap-2.5 py-1.5">
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
      <span className="flex-1" />
      {task.due_date && (
        <span className="text-xs text-muted-foreground">
          {new Date(task.due_date).toLocaleDateString()}
          {hasReminder && ` · Reminder ${reminderLeadLabel(task.reminder_lead_days!).toLowerCase()}`}
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          title="Edit task"
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <PencilIcon />
        </button>
        <ActionMenu
          items={[
            { label: "Edit task", onClick: () => setEditing(true) },
            task.due_date
              ? {
                  label: "Remove deadline",
                  onClick: () =>
                    updateSchedule.mutate({ taskId: task.id, dueDate: null, reminderLeadDays: null }),
                }
              : { label: "Set deadline", onClick: () => setMenuPopover("date") },
            hasReminder
              ? {
                  label: "Remove reminder",
                  onClick: () => updateSchedule.mutate({ taskId: task.id, reminderLeadDays: null }),
                }
              : { label: "Set reminder", onClick: () => setMenuPopover("reminder") },
            {
              label: task.done ? "Mark incomplete" : "Mark complete",
              onClick: () => toggleTask.mutate(task),
            },
            { label: "Delete", onClick: () => deleteTask.mutate(task.id), danger: true },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={() => setPopover(true)}
        aria-label={hasReminder ? "Change reminder" : "Set reminder"}
        title={hasReminder ? "Reminder set" : "Set a reminder"}
        className={`shrink-0 rounded p-0.5 transition-colors ${
          hasReminder ? "text-teal" : "text-muted-foreground/40 hover:text-muted-foreground"
        }`}
      >
        <BellIcon filled={hasReminder} />
      </button>

      {(popover || menuPopover) && (
        <SchedulePopover
          variant={menuPopover ?? "reminder"}
          currentDueDate={task.due_date}
          currentReminderLeadDays={task.reminder_lead_days}
          onClose={() => {
            setPopover(false);
            setMenuPopover(null);
          }}
          onSave={(patch) =>
            updateSchedule.mutate({
              taskId: task.id,
              ...("dueDate" in patch && { dueDate: patch.dueDate }),
              ...("reminderLeadDays" in patch && { reminderLeadDays: patch.reminderLeadDays }),
            })
          }
        />
      )}
    </li>
  );
}

function TopicItem({
  topic,
  trackId,
  expanded,
  onToggle,
}: {
  topic: Topic;
  trackId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: tasks } = useTasks(topic.id);
  const updateStatus = useUpdateTopicStatus(trackId);
  const updateTitle = useUpdateTopicTitle(trackId);
  const deleteTopic = useDeleteTopic(trackId);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const tasksCount = tasks?.length;
  const doneCount = tasks?.filter((t) => t.done).length ?? 0;
  const allDone = !!tasksCount && doneCount === tasksCount;

  async function saveTitle(e: FormEvent) {
    e.preventDefault();
    if (!titleDraft.trim()) return;
    await updateTitle.mutateAsync({ id: topic.id, title: titleDraft.trim() });
    setEditing(false);
  }

  return (
    <div className="group border-b border-border py-4 last:border-0">
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

        {editing ? (
          <form onSubmit={saveTitle} className="flex flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-[15px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={updateTitle.isPending || !titleDraft.trim()}
              className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setTitleDraft(topic.title);
                setEditing(false);
              }}
              className="shrink-0 text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <ChevronIcon expanded={expanded} />
              <span className="truncate text-[15px] font-medium">{topic.title}</span>
            </button>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit topic"
                title="Edit topic"
                className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <PencilIcon />
              </button>
              <ActionMenu
                items={[
                  { label: "Edit topic", onClick: () => setEditing(true) },
                  { label: "Delete topic", onClick: () => deleteTopic.mutate(topic.id), danger: true },
                ]}
              />
            </div>
            {!!tasksCount && (
              <span
                className={`ml-2 shrink-0 font-mono tabular-nums ${
                  expanded
                    ? "text-xs text-muted-foreground"
                    : `text-[13px] font-medium ${allDone ? "text-success" : "text-foreground"}`
                }`}
              >
                {doneCount} / {tasksCount}
                {allDone && " ✓"}
              </span>
            )}
          </>
        )}
      </div>

      {expanded && tasks && tasks.length > 0 && (
        <ul className="mt-2.5 flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} topicId={topic.id} />
          ))}
        </ul>
      )}

      {expanded && <NewTaskForm topicId={topic.id} />}
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
  const { data: progressMap } = useTrackProgress();
  const updateTrackStatus = useUpdateTrackStatus();
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  // Default to just the first incomplete topic open — a long roadmap
  // shouldn't land as one giant expanded wall.
  useEffect(() => {
    if (expanded === null && topics && topics.length > 0) {
      const firstIncomplete = topics.find((t) => t.status !== "done") ?? topics[0];
      setExpanded(new Set([firstIncomplete.id]));
    }
  }, [topics, expanded]);

  const expandedSet = expanded ?? new Set<string>();

  function toggleTopic(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const progress = progressMap?.get(track.id);
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{track.name}</h1>
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

      {progress && progress.total > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {progress.done} / {progress.total} · {pct}%
          </span>
        </div>
      )}

      {!!topics?.length && (
        <div className="mt-3 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setExpanded(new Set(topics.map((t) => t.id)))}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set())}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Stays put while scrolling through a long roadmap, so the track
          and its overall progress don't scroll out of view with the header. */}
      <div className="sticky top-0 z-10 mt-2 border-b border-border bg-background py-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium">{track.name}</span>
          {progress && progress.total > 0 && (
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {progress.done} / {progress.total} · {pct}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        {topicsLoading && <p className="text-sm text-muted-foreground">Loading topics…</p>}
        {!topicsLoading && topics?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No topics yet — add one below to start breaking this track down.
          </p>
        )}
        {topics?.map((topic) => (
          <TopicItem
            key={topic.id}
            topic={topic}
            trackId={track.id}
            expanded={expandedSet.has(topic.id)}
            onToggle={() => toggleTopic(topic.id)}
          />
        ))}
      </div>

      <NewTopicForm trackId={track.id} />
    </AppShell>
  );
}
