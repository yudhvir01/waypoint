import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NoteEditor } from "./NoteEditor";
import { useBackend } from "../context/BackendProvider";
import { useFocusTimer } from "../context/FocusTimerProvider";
import { useNoteAutosave } from "../hooks/useNotes";
import { useUpdateTask } from "../hooks/useTasks";
import type { Recurrence, Task, TaskPriority } from "../lib/database.types";
import { RECURRENCES, RECURRENCE_LABEL } from "../lib/recurrence";
import { formatClock as clock } from "../lib/focusTimer";

export interface TaskPlace {
  trackId: string;
  trackName: string;
  topicId: string;
  topicTitle: string;
}

// The task's own note, created the first time it is opened. Edited right
// here, so writing something about a task never means leaving the list.
function TaskNote({ taskId }: { taskId: string }) {
  const { backend } = useBackend();
  const { data: note, isLoading, isError } = useQuery({
    queryKey: ["taskNote", taskId],
    enabled: !!backend,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => backend!.getOrCreateTaskNote(taskId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading notes…</p>;
  if (isError || !note) return <p className="text-sm text-destructive">Couldn't open this task's notes.</p>;
  return <NoteBody key={note.id} noteId={note.id} content={note.content} />;
}

function NoteBody({ noteId, content }: { noteId: string; content: string }) {
  const { queue, status } = useNoteAutosave(noteId);
  return (
    <div>
      <div className="min-h-[9rem] rounded-md border border-border px-3 py-2">
        <NoteEditor initialContent={content} onChange={(html) => queue({ content: html })} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground" role="status">
        {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Couldn't save — check your connection"}
      </p>
    </div>
  );
}

// A task opened from a list: its whole title, its fields, its notes, and a
// way to start working on it.
export function TaskDetailSheet({
  task,
  place,
  onToggleDone,
  onClose,
}: {
  task: Task;
  place: TaskPlace;
  onToggleDone: () => void;
  onClose: () => void;
}) {
  const timer = useFocusTimer();
  const updateTask = useUpdateTask(task.topic_id);
  const panel = useRef<HTMLDivElement>(null);
  const titleBox = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(task.title);

  // A long title wraps onto more lines; the box grows to fit it.
  useLayoutEffect(() => {
    const el = titleBox.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    panel.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The provider re-renders this twice a second while a timer runs, so
  // the clock below stays current without a timer of its own.
  const focusingHere =
    (timer.state.phase === "focus" || timer.state.phase === "focus-done") && timer.state.taskId === task.id;

  function save(patch: Partial<{ title: string; priority: TaskPriority; dueDate: string | null; recurrence: Recurrence | null }>) {
    updateTask.mutate({
      taskId: task.id,
      title: patch.title ?? task.title,
      priority: patch.priority ?? task.priority,
      dueDate: "dueDate" in patch ? (patch.dueDate ?? null) : task.due_date,
      recurrence: "recurrence" in patch ? (patch.recurrence ?? null) : (task.recurrence ?? null),
    });
  }

  function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
      return;
    }
    if (next !== task.title) save({ title: next });
  }

  const field =
    "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <Link
            to={`/tracks/${place.trackId}?topic=${place.topicId}`}
            onClick={onClose}
            className="min-w-0 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
            title="Open this topic in its track"
          >
            {place.trackName} → {place.topicTitle}
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <textarea
            ref={titleBox}
            value={title}
            rows={1}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            aria-label="Task title"
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-xl font-semibold leading-snug tracking-[-0.01em] outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">Edit the title right here. Enter saves it.</p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Priority
              <select
                value={task.priority}
                onChange={(e) => save({ priority: e.target.value as TaskPriority })}
                className={field}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Deadline
              <input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => save({ dueDate: e.target.value || null })}
                className={field}
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
              Repeat
              <select
                value={task.recurrence ?? ""}
                onChange={(e) => save({ recurrence: (e.target.value || null) as Recurrence | null })}
                className={field}
              >
                <option value="">Doesn't repeat</option>
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {focusingHere && timer.state.phase === "focus" ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Focusing · {clock(timer.remaining)}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => timer.start({ id: task.id, title: task.title })}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Focus on this
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onToggleDone();
                onClose();
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-accent"
            >
              Mark done
            </button>
          </div>

          <h3 className="mt-7 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
          <div className="mt-2">
            <TaskNote taskId={task.id} />
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            <Link to={`/tasks/${task.id}/note`} onClick={onClose} className="hover:text-foreground hover:underline">
              Open notes as a full page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
