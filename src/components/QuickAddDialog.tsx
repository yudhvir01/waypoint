import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuickAdd, type QuickAddResult } from "../hooks/useQuickAdd";
import { useTracks } from "../hooks/useTracks";
import { INBOX_NAME } from "../lib/inbox";
import { matchTrack, parseQuickAdd } from "../lib/quickAdd";
import { RECURRENCE_LABEL } from "../lib/recurrence";

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
  const [last, setLast] = useState<QuickAddResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const quickAdd = useQuickAdd();
  const { data: tracks } = useTracks();

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const target = matchTrack(tracks ?? [], parsed.trackHint);

  useEffect(() => {
    input.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || quickAdd.isPending) return;
    try {
      setLast(await quickAdd.mutateAsync(text));
      setText("");
      input.current?.focus();
    } catch {
      // The error is shown from quickAdd.isError below; the text stays.
    }
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
          Quick add
        </label>
        <input
          id="quick-add"
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (quickAdd.isError) quickAdd.reset();
          }}
          placeholder="Read chapter 4 friday !high #cpp"
          autoComplete="off"
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />

        <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
          {text.trim() ? (
            <>
              {parsed.dueDate && <Chip>Due {new Date(parsed.dueDate + "T00:00").toLocaleDateString()}</Chip>}
              {parsed.priority !== "none" && <Chip>{parsed.priority} priority</Chip>}
              {parsed.recurrence && <Chip>↻ {RECURRENCE_LABEL[parsed.recurrence].toLowerCase()}</Chip>}
              {parsed.trackHint && !target ? (
                <Chip tone="warn">No track matches #{parsed.trackHint} — goes to {INBOX_NAME}</Chip>
              ) : (
                <Chip>→ {target ? target.name : INBOX_NAME}</Chip>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Try: <em>call dentist tomorrow</em>, <em>stretch every weekday</em>, <em>essay oct 20 !high</em>
            </span>
          )}
        </div>

        {last && !quickAdd.isError && (
          <p className="mt-3 text-xs text-success" role="status">
            Added “{last.title}” to {last.trackName}.
            {last.missedHint && ` No track matched #${last.missedHint}.`}
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
              disabled={!text.trim() || quickAdd.isPending}
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
