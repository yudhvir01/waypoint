import { useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BinIcon } from "../components/BinIcon";
import { NoteEditor } from "../components/NoteEditor";
import { useBackend } from "../context/BackendProvider";
import { useDeleteNote, useNote, useNoteAutosave, type SaveStatus } from "../hooks/useNotes";
import { useQuery } from "@tanstack/react-query";
import type { NoteWithContext } from "../lib/backend/types";
import { extractCards } from "../lib/cards";

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  error: "Couldn't save — check your connection",
};

function NoteBody({ note }: { note: NoteWithContext }) {
  const navigate = useNavigate();
  const deleteNote = useDeleteNote();
  const { queue, flush, status } = useNoteAutosave(note.id);
  const [title, setTitle] = useState(note.title);
  const [cardCount, setCardCount] = useState(() => extractCards(note.content).length);
  const focusBody = useRef<(() => void) | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  // A long title wraps onto more lines instead of running off the edge:
  // the box grows to fit its text.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);
  const isBlank = !note.title && !note.content;

  async function handleDelete() {
    await deleteNote.mutateAsync(note.id);
    navigate(note.context ? `/tracks/${note.context.trackId}` : "/", { replace: true });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 text-sm">
        {note.context ? (
          <Link
            to={`/tracks/${note.context.trackId}`}
            className="min-w-0 truncate text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {note.context.trackName}
            {note.context.topicTitle && ` · ${note.context.topicTitle}`}
          </Link>
        ) : (
          <span className="text-muted-foreground">Note</span>
        )}
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            role="status"
          >
            {status === "error" ? (
              <button type="button" onClick={() => void flush()} className="underline">
                {STATUS_LABEL.error} — retry
              </button>
            ) : (
              STATUS_LABEL[status]
            )}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteNote.isPending}
            aria-label="Delete note"
            title="Delete note"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
          >
            <BinIcon />
          </button>
        </div>
      </div>

      <textarea
        ref={titleRef}
        rows={1}
        // A brand-new note starts with the cursor in the title.
        autoFocus={isBlank}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          queue({ title: e.target.value });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            focusBody.current?.();
          }
        }}
        placeholder="Untitled"
        aria-label="Note title"
        className="mt-6 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-3xl font-semibold tracking-[-0.02em] outline-none placeholder:text-muted-foreground/50"
      />

      <div className="mt-5">
        <NoteEditor
          initialContent={note.content}
          onChange={(html) => {
            queue({ content: html });
            setCardCount(extractCards(html).length);
          }}
          focusStartRef={focusBody}
        />
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        {cardCount > 0 ? (
          <>
            {cardCount} flashcard{cardCount === 1 ? "" : "s"} in this note ·{" "}
            <Link to="/cards" className="underline underline-offset-2 hover:text-foreground">
              Review cards
            </Link>
          </>
        ) : (
          <>
            Tip: a line written as <code>question :: answer</code> becomes a flashcard.
          </>
        )}
      </p>
    </>
  );
}

export function NotePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const { data: note, isLoading, isError } = useNote(noteId);

  return (
    <AppShell wide>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-sm text-destructive">Couldn't load this note. Check your connection and reload.</p>
      )}
      {!isLoading && !isError && !note && <p className="text-sm text-muted-foreground">Note not found.</p>}
      {note && <NoteBody key={note.id} note={note} />}
    </AppShell>
  );
}

// /tasks/:taskId/note — what clicking a task lands on. Finds the task's
// note (creating it, titled with the task, the first time) and swaps
// itself for the real note URL so Back doesn't bounce through here.
export function TaskNoteRedirect() {
  const { taskId } = useParams<{ taskId: string }>();
  const { backend } = useBackend();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["taskNote", taskId],
    enabled: !!backend && !!taskId,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => backend!.getOrCreateTaskNote(taskId!),
  });

  if (data) return <Navigate to={`/notes/${data.id}`} replace />;

  return (
    <AppShell wide>
      {isLoading && <p className="text-sm text-muted-foreground">Opening note…</p>}
      {isError && (
        <p className="text-sm text-destructive">Couldn't open this note. Check your connection and reload.</p>
      )}
      {!isLoading && !isError && <p className="text-sm text-muted-foreground">That task no longer exists.</p>}
    </AppShell>
  );
}
