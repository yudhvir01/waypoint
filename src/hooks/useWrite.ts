import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Backend } from "../lib/backend/types";

// Every change the app makes goes through here, and the screen never waits
// for the backend:
//
//   1. `show` edits the cached lists straight away (see lib/cache.ts).
//   2. The save itself joins one queue shared by every write, so they
//      reach Supabase or Drive one at a time and in the order they were
//      made: a slow earlier save can't land after a later one.
//   3. Once the queue is empty, everything the writes touched is fetched
//      again, which swaps the guesses for what was really stored. If a
//      save failed, that refetch is what puts the screen back.
//
// Offline, the queue simply waits (except on guest, which needs no
// network) and carries on when the connection is back.

export const WRITE_KEY = ["write"];
const SCOPE = { id: "writes" };

const toRefresh = new Set<string>();

export function writesPending(qc: QueryClient): boolean {
  return qc.isMutating({ mutationKey: WRITE_KEY }) > 0;
}

function refreshWhenIdle(qc: QueryClient) {
  // onSettled runs while this write still counts as pending.
  window.setTimeout(() => {
    if (writesPending(qc)) return;
    const keys = [...toRefresh];
    toRefresh.clear();
    for (const key of keys) qc.invalidateQueries({ queryKey: [key] });
  }, 0);
}

// The last save that failed, for SaveNotice to show.
type Listener = () => void;
let lastError: { message: string; at: number } | null = null;
const listeners = new Set<Listener>();

export const saveErrors = {
  get: () => lastError,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  clear() {
    lastError = null;
    listeners.forEach((l) => l());
  },
};

function reportError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong.";
  lastError = { message, at: Date.now() };
  listeners.forEach((l) => l());
}

export interface WriteOptions<TVars, TResult> {
  run: (backend: Backend, vars: TVars) => Promise<TResult>;
  // The change as it should look, applied before the save starts.
  show?: (qc: QueryClient, vars: TVars) => void;
  // The first part of every query key this write can change.
  refresh: string[];
}

function writeOptions<TVars, TResult>(
  qc: QueryClient,
  backend: Backend | null,
  { run, show, refresh }: WriteOptions<TVars, TResult>,
) {
  return {
    mutationKey: WRITE_KEY,
    scope: SCOPE,
    networkMode: backend?.kind === "guest" ? ("always" as const) : ("online" as const),
    mutationFn: (vars: TVars) => run(backend!, vars),
    // Runs synchronously inside mutate(), so whatever the caller does next
    // (closing a dialog, opening the new note) already sees the change.
    onMutate: (vars: TVars) => {
      for (const key of refresh) {
        toRefresh.add(key);
        // A fetch already on its way would land on top of the change with
        // data from before it.
        void qc.cancelQueries({ queryKey: [key] });
      }
      show?.(qc, vars);
    },
    onError: reportError,
    onSettled: () => refreshWhenIdle(qc),
  };
}

export function useWrite<TVars = void, TResult = unknown>(options: WriteOptions<TVars, TResult>) {
  const { backend } = useBackend();
  const qc = useQueryClient();
  return useMutation(writeOptions(qc, backend, options));
}

// The same, for code that has to queue a save outside a component's life,
// like a note's last edits being saved after it's closed. The promise
// settles when that save is done; nothing has to wait for it.
export function enqueueWrite<TVars, TResult>(
  qc: QueryClient,
  backend: Backend,
  options: WriteOptions<TVars, TResult>,
  vars: TVars,
): Promise<TResult> {
  const mutation = qc.getMutationCache().build(qc, writeOptions(qc, backend, options));
  return mutation.execute(vars);
}

// Resolves once every queued save is done. For reads that would go wrong
// against data that hasn't reached the backend yet, like opening the notes
// of a task that was added a moment ago.
export function afterWrites(qc: QueryClient): Promise<void> {
  if (!writesPending(qc)) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = qc.getMutationCache().subscribe(() => {
      if (writesPending(qc)) return;
      stop();
      resolve();
    });
  });
}
