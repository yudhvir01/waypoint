import { useState, type FormEvent } from "react";
import { AppShell } from "../components/AppShell";
import { ImportMarkdownDialog } from "../components/ImportMarkdownDialog";
import { useCreateTrack, useTracks } from "../hooks/useTracks";
import { useFocusNow, useToggleFocusTask, type FocusTask } from "../hooks/useFocusNow";
import type { Task } from "../lib/database.types";

function dueLabel(dueDate: string | null): { text: string; className: string } | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const delta = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (delta < 0) return { text: `${-delta}d overdue`, className: "text-destructive" };
  if (delta === 0) return { text: "Due today", className: "text-destructive" };
  if (delta === 1) return { text: "Due tomorrow", className: "text-amber-600 dark:text-amber-400" };
  if (delta <= 6) return { text: `Due in ${delta}d`, className: "text-amber-600 dark:text-amber-400" };
  return { text: `Due ${due.toLocaleDateString()}`, className: "text-muted-foreground" };
}

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
  none: "bg-transparent",
};

function isUrgent(task: FocusTask): boolean {
  if (!task.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const delta = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return delta <= 1;
}

function TaskRow({ task }: { task: FocusTask }) {
  const toggleTask = useToggleFocusTask();
  const due = dueLabel(task.due_date);

  return (
    <li className="flex items-start gap-3 border-b border-border py-4 last:border-0">
      <button
        type="button"
        onClick={() => toggleTask.mutate(task)}
        aria-label="Mark done"
        className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-input transition-colors hover:border-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">{task.title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
          <span className="truncate">
            {task.topic.track.name} &rarr; {task.topic.title}
          </span>
        </div>
      </div>
      {due && <span className={`mt-0.5 shrink-0 text-xs ${due.className}`}>{due.text}</span>}
    </li>
  );
}

function FocusNowList() {
  const { data: tasks, isLoading } = useFocusNow();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="py-6">
        <p className="text-[15px]">Nothing needs your attention.</p>
        <p className="mt-1 text-sm text-muted-foreground">You're clear for today.</p>
      </div>
    );
  }

  const today = tasks.filter(isUrgent).slice(0, 8);
  const upNext = tasks.filter((t) => !isUrgent(t)).slice(0, Math.max(0, 8 - today.length));

  return (
    <div className="flex flex-col gap-8">
      {today.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today
          </p>
          <ul className="mt-2">
            {today.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      )}
      {upNext.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Up next
          </p>
          <ul className="mt-2">
            {upNext.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NewTrackMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "import" | null>(null);
  const [name, setName] = useState("");
  const createTrack = useCreateTrack();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createTrack.mutateAsync({ name: name.trim() });
    setName("");
    setMode(null);
    setOpen(false);
  }

  if (mode === "import") {
    return <ImportMarkdownDialog onClose={() => { setMode(null); setOpen(false); }} />;
  }

  if (mode === "manual") {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !name && setMode(null)}
          placeholder="Track name"
          className="w-56 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={createTrack.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          Add
        </button>
      </form>
    );
  }

  if (!open) {
    if (compact) {
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Create track
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Import Markdown
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent hover:text-primary"
      >
        + Add track
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1 text-sm">
      <button
        type="button"
        onClick={() => setMode("manual")}
        className="rounded px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Create manually
      </button>
      <span className="text-border">·</span>
      <button
        type="button"
        onClick={() => setMode("import")}
        className="rounded px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Import Markdown
      </button>
    </div>
  );
}

export function Dashboard() {
  const { data: tracks, isLoading: tracksLoading } = useTracks();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (!tracksLoading && tracks?.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-start py-16">
          <h1 className="text-2xl font-semibold">Your workspace is empty</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Create your first track, or import one from Markdown.
          </p>
          <div className="mt-6">
            <NewTrackMenu compact />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Focus Now</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{today}</p>
        </div>
        <NewTrackMenu />
      </div>

      <div className="mt-9">
        <FocusNowList />
      </div>
    </AppShell>
  );
}
