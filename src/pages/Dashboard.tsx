import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useSupabase } from "../context/SupabaseProvider";
import { Logo } from "../components/Logo";
import { ImportMarkdownDialog } from "../components/ImportMarkdownDialog";
import { useCreateTrack, useTracks } from "../hooks/useTracks";
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
  if (delta === 1) return { text: "Due tomorrow", className: "text-amber-500" };
  if (delta <= 6) return { text: `Due in ${delta}d`, className: "text-amber-500" };
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
        Nothing needs your attention right now. Add a task to a topic to see it here.
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
            className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => toggleTask.mutate(task)}
              aria-label="Mark done"
              className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-input"
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

function NewTrackForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createTrack = useCreateTrack();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createTrack.mutateAsync({ name: name.trim() });
    setName("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        + New track
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name && setOpen(false)}
        placeholder="Track name (e.g. C++, Robotics)"
        className="w-64 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
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

export function Dashboard() {
  const { session, client } = useSupabase();
  const { data: tracks, isLoading, refetch } = useTracks();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Logo size={28} />
        <div className="flex items-center gap-4">
          <Link to="/settings" className="text-sm text-muted-foreground hover:underline">
            Reminders
          </Link>
          <button
            type="button"
            onClick={() => client?.auth.signOut()}
            className="text-sm text-muted-foreground hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Signed in as {session?.user.email}.</p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-foreground">Focus Now</h2>
        <div className="mt-3">
          <FocusNowList />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Tracks</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Import from Markdown
            </button>
            <NewTrackForm onCreated={refetch} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && tracks?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tracks yet — add one above to get started.
            </p>
          )}
          {tracks?.map((track) => (
            <Link
              key={track.id}
              to={`/tracks/${track.id}`}
              className="rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:border-primary"
            >
              {track.name}
            </Link>
          ))}
        </div>
      </section>

      {importOpen && <ImportMarkdownDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
