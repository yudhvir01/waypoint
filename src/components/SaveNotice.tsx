import { useEffect, useSyncExternalStore } from "react";
import { onlineManager, useMutationState, useQueryClient } from "@tanstack/react-query";
import { saveErrors, WRITE_KEY, writesPending } from "../hooks/useWrite";

const SHOW_ERROR_MS = 6000;

// Changes show the moment they're made and save behind the scenes, so the
// only things worth saying are the exceptions: a save that failed (the
// screen has already gone back to what's stored), or changes waiting for
// the connection to come back.
export function SaveNotice() {
  const qc = useQueryClient();
  const error = useSyncExternalStore(saveErrors.subscribe, saveErrors.get);
  const online = useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
  // Saves queued behind another one count as paused too, so it's only
  // "waiting for the connection" when there isn't one.
  const paused = useMutationState({
    filters: { mutationKey: WRITE_KEY, status: "pending" },
    select: (m) => m.state.isPaused,
  }).some(Boolean);
  const waiting = !online && paused;

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(saveErrors.clear, SHOW_ERROR_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  // Closing the tab with saves still queued would lose them.
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (writesPending(qc)) e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [qc]);

  if (!error && !waiting) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      className="fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex max-w-md items-start gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm shadow-lg">
        {error ? (
          <>
            <p className="min-w-0 text-foreground">
              Couldn't save your last change, so it's been undone.{" "}
              <span className="text-muted-foreground">{error.message}</span>
            </p>
            <button
              type="button"
              onClick={saveErrors.clear}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              OK
            </button>
          </>
        ) : (
          <p className="text-muted-foreground">You're offline. Your changes will save when you're back online.</p>
        )}
      </div>
    </div>
  );
}
