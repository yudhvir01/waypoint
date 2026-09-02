import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSupabase } from "../context/SupabaseProvider";
import { useTracks } from "../hooks/useTracks";
import { useTrackProgress } from "../hooks/useTrackProgress";
import { LogoMark } from "./Logo";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-[15px] transition-colors ${
        active
          ? "bg-accent font-medium text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { session, client } = useSupabase();
  const { data: tracks } = useTracks();
  const { data: progress } = useTrackProgress();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card px-5 py-7">
        <Link to="/" className="flex items-center gap-2.5 px-1">
          <LogoMark size={24} />
          <span className="text-[17px] font-semibold tracking-tight">Waypoint</span>
        </Link>

        <nav className="mt-9 flex flex-col gap-0.5">
          <NavLink to="/">Focus Now</NavLink>
        </nav>

        <div className="mt-8 flex flex-col gap-0.5">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tracks
          </p>
          {tracks?.map((track) => {
            const p = progress?.get(track.id);
            return (
              <Link
                key={track.id}
                to={`/tracks/${track.id}`}
                className="flex items-center justify-between rounded-md px-3 py-1.5 text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <span className="truncate">{track.name}</span>
                {p && p.total > 0 && (
                  <span className="ml-2 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {p.done}/{p.total}
                  </span>
                )}
              </Link>
            );
          })}
          {tracks?.length === 0 && (
            <p className="px-3 text-sm text-muted-foreground">No tracks yet</p>
          )}
        </div>

        <Link
          to="/archived"
          className="mt-3 rounded-md px-3 py-1 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          Archived
        </Link>

        <div className="mt-auto flex flex-col gap-0.5 pt-6">
          <NavLink to="/settings">Settings</NavLink>
          <Link
            to="/guide"
            className="rounded-md px-3 py-1.5 text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Guide
          </Link>
          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="rounded-md px-3 py-1.5 text-left text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Sign out
          </button>
          <p className="mt-2 truncate px-3 text-xs text-muted-foreground">
            {session?.user.email}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-14 py-12">
        <div className={`mx-auto ${wide ? "max-w-3xl" : "max-w-2xl"}`}>{children}</div>
      </div>

      {confirmSignOut && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setConfirmSignOut(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold">Sign out?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You'll need to log back in with {session?.user.email} to see your tracks.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => client?.auth.signOut()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
