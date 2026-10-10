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
import { useLinkIndex } from "../hooks/useLinkIndex";
import { findBacklinks, linkTitles, resolveLink } from "../lib/links";

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  error: "Couldn't save — check your connection",
};

const KIND_LABEL = { note: "Note", task: "Task", topic: "Topic", track: "Track" } as const;

// What this note points at, what points at it, and a way to follow either.
function NoteLinks({ noteId, title, html }: { noteId: string; title: string; html: string }) {
  const { backend } = useBackend();
  const navigate = useNavigate();
  const { data: index } = useLinkIndex();
  const [creating, setCreating] = useState<string | null>(null);

  const outgoing = linkTitles(html);
  const backlinks = index ? findBacklinks(noteId, title, index.notes) : [];
  if (outgoing.length === 0 && backlinks.length === 0) return null;

  async function createAndOpen(linkTitle: string) {
    if (!backend) return;
    setCreating(linkTitle);
    try {
      const created = await backend.createNote({ title: linkTitle });
      navigate(`/notes/${created.id}`);
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="mt-8 grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
      {outgoing.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {outgoing.map((linkTitle) => {
              const target = index ? resolveLink(linkTitle, index) : null;
              return (
                <li key={linkTitle} className="flex items-baseline justify-between gap-2 text-sm">
                  {target ? (
                    <>
                      <Link to={target.path} className="min-w-0 truncate text-primary hover:underline">
                        {target.label}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{KIND_LABEL[target.kind]}</span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 truncate text-muted-foreground">{linkTitle}</span>
                      <button
                        type="button"
                        disabled={!index || creating === linkTitle}
                        onClick={() => void createAndOpen(linkTitle)}
                        className="shrink-0 text-xs text-primary hover:underline disabled:opacity-60"
                      >
                        {creating === linkTitle ? "Creating…" : "Create note"}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {backlinks.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Linked from · {backlinks.length}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {backlinks.map(({ note: from, snippet }) => (
              <li key={from.id} className="text-sm">
                <Link to={`/notes/${from.id}`} className="block truncate text-primary hover:underline">
                  {from.title || "Untitled"}
                </Link>
                <span className="block text-xs text-muted-foreground">{snippet}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NoteBody({ note }: { note: NoteWithContext }) {
  const navigate = useNavigate();
  const deleteNote = useDeleteNote();
  const { queue, flush, status } = useNoteAutosave(note.id);
  const [title, setTitle] = useState(note.title);
  const [cardCount, setCardCount] = useState(() => extractCards(note.content).length);
  const [html, setHtml] = useState(note.content);
  const { data: linkIndex } = useLinkIndex();
  const { backend } = useBackend();
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
          onChange={(next) => {
            queue({ content: next });
            setCardCount(extractCards(next).length);
            setHtml(next);
          }}
          onOpenLink={async (linkTitle) => {
            const target = linkIndex ? resolveLink(linkTitle, linkIndex) : null;
            if (target) {
              await flush();
              navigate(target.path);
            } else if (backend) {
              // A link to nothing yet becomes a note of that name.
              await flush();
              const created = await backend.createNote({ title: linkTitle });
              navigate(`/notes/${created.id}`);
            }
          }}
          focusStartRef={focusBody}
        />
      </div>

      <NoteLinks noteId={note.id} title={title} html={html} />

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
            Tips: a line written as <code>question :: answer</code> becomes a flashcard, and{" "}
            <code>[[Some title]]</code> links to a note, task, topic or track (Ctrl/Cmd+click to open).
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
