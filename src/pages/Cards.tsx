import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { useBackend } from "../context/BackendProvider";
import { useCards, useReviewCard, useScanNotes } from "../hooks/useCards";
import type { Card } from "../lib/database.types";
import {
  GRADES,
  SESSION_LIMIT,
  buildSession,
  intervalLabel,
  nextDueDate,
  scheduleCard,
  type Grade,
} from "../lib/cards";

const GRADE_LABEL: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const GRADE_STYLE: Record<Grade, string> = {
  again: "border-destructive/40 text-destructive hover:bg-destructive/10",
  hard: "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
  good: "border-primary/40 text-primary hover:bg-primary/10",
  easy: "border-success/40 text-success hover:bg-success/10",
};

function Session({ initial, waiting, onFinished }: { initial: Card[]; waiting: number; onFinished: () => void }) {
  const [queue, setQueue] = useState<Card[]>(initial);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const review = useReviewCard();
  const current = queue[0];

  const grade = useCallback(
    (g: Grade) => {
      if (!current) return;
      const schedule = scheduleCard(current, g);
      // The next card appears at once; saving happens behind it.
      review.mutate({ id: current.id, schedule }, { onError: () => setSaveFailed(true) });
      setQueue((q) => {
        const [, ...rest] = q;
        // "Again" comes back later in this same session.
        return g === "again" ? [...rest, { ...current, ...schedule }] : rest;
      });
      if (g !== "again") setReviewed((n) => n + 1);
      setRevealed(false);
    },
    [current, review],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (e.key >= "1" && e.key <= "4") grade(GRADES[Number(e.key) - 1]);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        grade("good");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, grade]);

  if (!current) {
    return (
      <div className="mt-10 rounded-lg border border-border bg-card px-6 py-10 text-center">
        <p className="text-lg font-medium">Done for now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {reviewed} card{reviewed === 1 ? "" : "s"} reviewed.
          {waiting > 0 && ` ${waiting} more ${waiting === 1 ? "is" : "are"} waiting, but they'll keep.`}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          {waiting > 0 && (
            <button
              type="button"
              onClick={onFinished}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Review {Math.min(waiting, SESSION_LIMIT)} more
            </button>
          )}
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary hover:bg-accent"
          >
            Back to Focus Now
          </Link>
        </div>
        {saveFailed && (
          <p className="mt-4 text-xs text-destructive">
            Some reviews couldn't be saved. Check your connection; those cards will show up again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {queue.length} left{waiting > 0 && ` · ${waiting} more waiting`}
        </span>
        {current.note_id && (
          <Link to={`/notes/${current.note_id}`} className="hover:text-foreground hover:underline">
            Open note
          </Link>
        )}
      </div>

      <div className="mt-2 flex min-h-[12rem] flex-col justify-center rounded-lg border border-border bg-card px-6 py-8">
        <p className="whitespace-pre-wrap break-words text-center text-lg">{current.front}</p>
        {revealed && (
          <>
            <hr className="my-6 border-border" />
            <p className="whitespace-pre-wrap break-words text-center text-lg text-primary">{current.back}</p>
          </>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-4 w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Show answer <span className="ml-1 text-xs opacity-70">Space</span>
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {GRADES.map((g, i) => (
            <button
              key={g}
              type="button"
              onClick={() => grade(g)}
              className={`rounded-md border px-2 py-2 text-sm transition-colors ${GRADE_STYLE[g]}`}
            >
              <span className="block font-medium">{GRADE_LABEL[g]}</span>
              <span className="block text-xs opacity-70">
                {intervalLabel(scheduleCard(current, g).interval_days)} · {i + 1}
              </span>
            </button>
          ))}
        </div>
      )}
      {saveFailed && (
        <p className="mt-3 text-xs text-destructive">
          A review couldn't be saved. Check your connection; that card will show up again.
        </p>
      )}
    </div>
  );
}

export function Cards() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const { data: cards, isLoading, isError, refetch } = useCards();
  const scan = useScanNotes();
  // Bumped to start the next batch once the current one is finished.
  const [round, setRound] = useState(0);

  const session = cards ? buildSession(cards) : null;
  const upcoming = cards ? nextDueDate(cards) : null;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Cards</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        Flashcards made from your notes.
        {session && session.dueTotal > 0 && ` ${session.dueTotal} due today.`}
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

      {isError && (
        <div className="mt-8">
          <p className="text-sm text-destructive">Couldn't load your cards.</p>
          {backend?.kind === "supabase" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Cards need the latest <code>supabase/setup.sql</code> to be run on your project.
            </p>
          )}
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {cards && cards.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-border px-6 py-8">
          <p className="text-[15px] font-medium">No cards yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            There's no card editor. In any note, write a line like this and it becomes a card:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-accent px-3 py-2 text-sm">
            What does RAII stand for? :: Resource Acquisition Is Initialization
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            Cards are made when a note is saved. For notes you already have:
          </p>
          <button
            type="button"
            disabled={scan.isPending}
            onClick={() => scan.mutate()}
            className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
          >
            {scan.isPending ? "Looking…" : "Find cards in my notes"}
          </button>
          {scan.isSuccess && (
            <p className="mt-2 text-xs text-muted-foreground">
              {scan.data.cards === 0
                ? "No question :: answer lines found in your notes."
                : `Found ${scan.data.cards} card${scan.data.cards === 1 ? "" : "s"} in ${scan.data.notes} note${
                    scan.data.notes === 1 ? "" : "s"
                  }.`}
            </p>
          )}
          {scan.isError && <p className="mt-2 text-xs text-destructive">Couldn't scan your notes.</p>}
        </div>
      )}

      {session && cards && cards.length > 0 && session.queue.length > 0 && (
        <Session
          // A fresh batch is a fresh session, so its queue starts over.
          key={`${round}-${session.queue[0].id}`}
          initial={session.queue}
          waiting={session.waiting}
          onFinished={async () => {
            await queryClient.invalidateQueries({ queryKey: ["cards"] });
            setRound((r) => r + 1);
          }}
        />
      )}

      {session && cards && cards.length > 0 && session.queue.length === 0 && (
        <div className="mt-10 rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-lg font-medium">Nothing due</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length} card{cards.length === 1 ? "" : "s"} in total.
            {upcoming && ` Next one is due ${new Date(upcoming + "T00:00").toLocaleDateString()}.`}
          </p>
        </div>
      )}
    </AppShell>
  );
}
