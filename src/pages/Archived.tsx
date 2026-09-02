import { AppShell } from "../components/AppShell";
import { useTracks, useUpdateTrackStatus } from "../hooks/useTracks";

export function Archived() {
  const { data: tracks, isLoading } = useTracks("archived");
  const updateStatus = useUpdateTrackStatus();

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Archived tracks</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Archiving hides a track from the sidebar and Focus Now. Nothing is
        deleted — restore it here any time.
      </p>

      <div className="mt-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && tracks?.length === 0 && (
          <p className="text-sm text-muted-foreground">No archived tracks.</p>
        )}
        {tracks?.map((track) => (
          <div
            key={track.id}
            className="flex items-center justify-between border-b border-border py-3 last:border-0"
          >
            <span className="text-[15px]">{track.name}</span>
            <button
              type="button"
              onClick={() => updateStatus.mutate({ id: track.id, status: "active" })}
              disabled={updateStatus.isPending}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary disabled:opacity-60"
            >
              Unarchive
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
