import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuickAdd } from "../hooks/useQuickAdd";
import { TODO_NAME } from "../lib/inbox";
import { parseQuickAdd } from "../lib/quickAdd";
import { fromDateKey, RECURRENCE_LABEL } from "../lib/recurrence";
import { LIMITS } from "../lib/limits";

// "Due Fri, 23 Oct · in 5 days", so a worked-out date can be checked at a glance.
function dueText(dateKey: string): string {
  const due = fromDateKey(dateKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return `Due ${due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${when}`;
}

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warn" }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        tone === "warn"
          ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
          : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

// One line in, one task out. Stays open after adding so a handful of
// things can be captured in a row; Escape closes it.
export function QuickAddDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [last, setLast] = useState<{ title: string; trackName: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const quickAdd = useQuickAdd();

  const parsed = useMemo(() => parseQuickAdd(text), [text]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    quickAdd.mutate({ text, id: crypto.randomUUID() });
    setLast({ title: parsed.title, trackName: TODO_NAME });
    setText("");
    input.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-xl"
      >
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="quick-add">
          Add a task
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Write it in plain words. When (“tomorrow”, “after 5 days”, “oct 20”), a repeat (“every weekday”) and{" "}
          <code>!high</code> are picked out for you. It goes on your {TODO_NAME} list; to add a task to a topic, use{" "}
          <b className="font-medium text-foreground">+ Add task</b> on that track's page.
        </p>
        <input
          id="quick-add"
          ref={input}
          value={text}
          maxLength={LIMITS.taskTitle}
          onChange={(e) => {
            setText(e.target.value);
            if (quickAdd.isError) quickAdd.reset();
          }}
          placeholder="Remind me to call the bank after 5 days"
          autoComplete="off"
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />

        <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
          {text.trim() ? (
            <>
              <span className="mr-1 max-w-full truncate text-xs text-foreground">“{parsed.title}”</span>
              {parsed.dueDate && <Chip>{dueText(parsed.dueDate)}</Chip>}
              {parsed.priority !== "none" && <Chip>{parsed.priority} priority</Chip>}
              {parsed.recurrence && <Chip>↻ {RECURRENCE_LABEL[parsed.recurrence].toLowerCase()}</Chip>}
              <Chip>→ {TODO_NAME}</Chip>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Try: <em>remind me to pay rent after 5 days</em>, <em>stretch every weekday</em>,{" "}
              <em>essay oct 20 !high</em>
            </span>
          )}
        </div>

        {last && !quickAdd.isError && (
          <p className="mt-3 text-xs text-success" role="status">
            Added “{last.title}” to {last.trackName}.
          </p>
        )}
        {quickAdd.isError && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            Couldn't add that. Check your connection and try again.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Enter to add · Esc to close</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
