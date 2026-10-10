import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { useDeleteTrack, useTracks, useUpdateTrackStatus } from "../hooks/useTracks";
import { useTrackProgress } from "../hooks/useTrackProgress";
import type { Track } from "../lib/database.types";

function ConfirmDelete({
  track,
  taskCount,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  track: Track;
  taskCount: number | undefined;
  pending: boolean;
  error: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={pending ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-track-title"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-track-title" className="text-base font-semibold">
          Delete “{track.name}” for good?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This removes the track
          {taskCount !== undefined && taskCount > 0
            ? ` and its ${taskCount} task${taskCount === 1 ? "" : "s"}`
            : " and everything in it"}
          , along with its topics. <strong className="font-medium text-foreground">It can't be undone.</strong>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Notes you wrote on its tasks are kept as standalone notes, and the focus time you logged stays in
          your totals.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">Couldn't delete it. Try again.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Archived() {
  const { data: tracks, isLoading } = useTracks("archived");
  const { data: progress } = useTrackProgress();
  const updateStatus = useUpdateTrackStatus();
  const deleteTrack = useDeleteTrack();
  const [toDelete, setToDelete] = useState<Track | null>(null);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Archived tracks</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Archiving hides a track from the sidebar and Focus Now, and nothing is deleted: restore it here any
        time. Or delete it permanently once you're sure you're done with it.
      </p>

      <div className="mt-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && tracks?.length === 0 && (
          <p className="text-sm text-muted-foreground">No archived tracks.</p>
        )}
        {tracks?.map((track) => (
          <div
            key={track.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-3 last:border-0"
          >
            <span className="min-w-0 truncate text-[15px]">{track.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => updateStatus.mutate({ id: track.id, status: "active" })}
                disabled={updateStatus.isPending}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary disabled:opacity-60"
              >
                Unarchive
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTrack.reset();
                  setToDelete(track);
                }}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                Delete…
              </button>
            </div>
          </div>
        ))}
      </div>

      {toDelete && (
        <ConfirmDelete
          track={toDelete}
          taskCount={progress?.get(toDelete.id)?.total}
          pending={deleteTrack.isPending}
          error={deleteTrack.isError}
          onCancel={() => setToDelete(null)}
          onConfirm={() => deleteTrack.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
        />
      )}
    </AppShell>
  );
}
