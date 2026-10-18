import { useCallback, useEffect, useRef, useState } from "react";
import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { NoteWithContext } from "../lib/backend/types";
import type { Note } from "../lib/database.types";
import * as cache from "../lib/cache";
import { extractCards } from "../lib/cards";
import { attachmentIdsIn, queueAttachmentCleanup } from "../lib/backend/attachmentCleanup";
import { enqueueWrite, useWrite } from "./useWrite";

export function useNotes() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["notes"],
    enabled: !!backend,
    queryFn: () => backend!.listNotes(),
  });
}

export function useNote(noteId: string | undefined) {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["note", noteId],
    enabled: !!backend && !!noteId,
    // Edits are saved as they're typed, so the cached copy is always
    // behind the editor — never refetch it out from under the cursor.
    staleTime: Infinity,
    queryFn: () => backend!.getNote(noteId!),
  });
}

export function useCreateNote() {
  return useWrite({
    run: (backend, input: { id?: string; title?: string; content?: string }) => backend.createNote(input),
    show: (qc, input) => {
      input.id ??= crypto.randomUUID();
      const now = new Date().toISOString();
      cache.addNote(qc, {
        id: input.id,
        user_id: "",
        task_id: null,
        title: input.title ?? "",
        content: input.content ?? "",
        created_at: now,
        updated_at: now,
      });
    },
    refresh: ["notes", "linkIndex"],
  });
}

export function useDeleteNote() {
  return useWrite({
    run: (backend, id: string) => backend.deleteNote(id),
    show: (qc, id) => cache.removeNote(qc, id),
    refresh: ["notes", "cards", "linkIndex"],
  });
}

// "saved" covers both written and on its way: the screen never waits on a
// save, so there's nothing to say until one fails or has to wait for the
// connection.
export type SaveStatus = "saved" | "offline" | "error";

type NotePatch = { title?: string; content?: string };

// Autosave for one open note. Edits are collected and handed to the write
// queue after a short pause (so every keystroke isn't a request), and
// whatever is left is handed over when the note is closed. The queue keeps
// them in order behind any other change, including the note's own
// creation, so a brand-new note can be typed into at once.
export function useNoteAutosave(noteId: string) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const pending = useRef<NotePatch>({});
  const timer = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<SaveStatus>("saved");

  const flush = useCallback((): void => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    if (!backend || Object.keys(patch).length === 0) return;
    pending.current = {};
    if (!onlineManager.isOnline() && backend.kind !== "guest") setStatus("offline");
    enqueueWrite(
      queryClient,
      backend,
      {
        run: async (b, p: NotePatch) => {
          if (cache.deletedNotes.has(noteId)) return;
          const before = queryClient.getQueryData<NoteWithContext | null>(["note", noteId])?.content;
          await b.updateNote(noteId, p);
          queryClient.setQueryData<NoteWithContext | null>(["note", noteId], (old) => (old ? { ...old, ...p } : old));
          if (p.content !== undefined && before !== undefined) {
            // Not deleted yet: undo can still bring the node back. See
            // attachmentCleanup.ts.
            const kept = attachmentIdsIn(p.content);
            queueAttachmentCleanup(b.kind, [...attachmentIdsIn(before)].filter((id) => !kept.has(id)));
          }
          if (p.content !== undefined) {
            // Cards are made from the note's text, so they follow every
            // save. A failure here (say, an older Supabase project without
            // the cards table) must not make the note itself look unsaved.
            try {
              await b.syncNoteCards(noteId, extractCards(p.content));
            } catch {
              // The note is saved; cards will catch up on the next save.
            }
          }
        },
        // The note's own text stays as the editor has it; only the lists
        // that show its title are updated straight away.
        show: (qc, p) => {
          if (p.title !== undefined) {
            qc.setQueriesData<Note[]>({ queryKey: ["notes"] }, (old) =>
              old?.map((n) => (n.id === noteId ? { ...n, title: p.title! } : n)),
            );
          }
        },
        refresh: ["notes", "linkIndex", "cards"],
      },
      patch,
    ).then(
      () => setStatus((s) => (s === "error" && Object.keys(pending.current).length > 0 ? s : "saved")),
      () => {
        // Keep the failed text queued (newer edits win) so the next edit
        // or "Retry" writes it again.
        pending.current = { ...patch, ...pending.current };
        setStatus("error");
      },
    );
  }, [backend, noteId, queryClient]);

  const queue = useCallback(
    (patch: NotePatch) => {
      pending.current = { ...pending.current, ...patch };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 800);
    },
    [flush],
  );

  useEffect(
    () => () => {
      flush();
    },
    [flush],
  );

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (Object.keys(pending.current).length > 0) e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Drops edits not handed over yet, for a note about to be deleted.
  const discard = useCallback(() => {
    window.clearTimeout(timer.current);
    pending.current = {};
  }, []);

  return { queue, flush, discard, status };
}
