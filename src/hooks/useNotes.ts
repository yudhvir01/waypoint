import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { NoteWithContext } from "../lib/backend/types";

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
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => backend!.createNote(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useDeleteNote() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => backend!.deleteNote(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["note", id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export type SaveStatus = "saved" | "saving" | "error";

type NotePatch = { title?: string; content?: string };

// Debounced autosave for one open note. Edits are queued and written after
// a short pause; whatever is still pending is flushed when the note is
// closed, and the browser warns before a tab is closed with unsaved text.
// Saves go through the backend directly rather than a mutation, because
// the closing flush has to run after this component has unmounted.
export function useNoteAutosave(noteId: string) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const pending = useRef<NotePatch>({});
  const timer = useRef<number | undefined>(undefined);
  // Saves run one at a time, in order, so a slow earlier write can never
  // land after (and overwrite) a later one.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<SaveStatus>("saved");

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      const patch = pending.current;
      if (!backend || Object.keys(patch).length === 0) return;
      pending.current = {};
      try {
        await backend.updateNote(noteId, patch);
        queryClient.setQueryData<NoteWithContext | null>(["note", noteId], (old) =>
          old ? { ...old, ...patch } : old,
        );
        if (patch.title !== undefined) queryClient.invalidateQueries({ queryKey: ["notes"] });
        setStatus(Object.keys(pending.current).length > 0 ? "saving" : "saved");
      } catch {
        // Keep the failed text queued (newer edits win) so the next edit
        // or "Retry" writes it again.
        pending.current = { ...patch, ...pending.current };
        setStatus("error");
      }
    });
    return chain.current;
  }, [backend, noteId, queryClient]);

  const queue = useCallback(
    (patch: NotePatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 800);
    },
    [flush],
  );

  useEffect(
    () => () => {
      void flush();
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

  return { queue, flush, status };
}
