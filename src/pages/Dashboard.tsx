import { useState, type FormEvent } from "react";
import { AppShell } from "../components/AppShell";
import { ImportMarkdownDialog } from "../components/ImportMarkdownDialog";
import { useCreateTrack } from "../hooks/useTracks";
import { useFocusNow, useToggleFocusTask } from "../hooks/useFocusNow";
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

function FocusNowList() {
  const { data: tasks, isLoading } = useFocusNow();
  const toggleTask = useToggleFocusTask();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing needs your attention right now.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.slice(0, 8).map((task) => {
        const due = dueLabel(task.due_date);
        return (
          <li
            key={task.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <button
              type="button"
              onClick={() => toggleTask.mutate(task)}
              aria-label="Mark done"
              className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-input transition-colors hover:border-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
                />
                <p className="truncate text-sm">{task.title}</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {task.topic.track.name} · {task.topic.title}
              </p>
            </div>
            {due && <span className={`shrink-0 text-xs ${due.className}`}>{due.text}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function NewTrackMenu() {
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
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Focus Now</h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </div>
        <NewTrackMenu />
      </div>

      <div className="mt-8">
        <FocusNowList />
      </div>
    </AppShell>
  );
}
