import type { ReactNode } from "react";
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
      className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, client } = useSupabase();
  const { data: tracks } = useTracks();
  const { data: progress } = useTrackProgress();

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border px-4 py-8">
        <Link to="/" className="flex items-center gap-2 px-1">
          <LogoMark size={22} />
          <span className="text-base font-semibold tracking-tight">Waypoint</span>
        </Link>

        <nav className="mt-8 flex flex-col gap-0.5">
          <NavLink to="/">Focus Now</NavLink>
        </nav>

        <div className="mt-6 flex flex-col gap-0.5">
          <p className="px-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tracks
          </p>
          {tracks?.map((track) => {
            const p = progress?.get(track.id);
            return (
              <Link
                key={track.id}
                to={`/tracks/${track.id}`}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <span className="truncate">{track.name}</span>
                {p && p.total > 0 && (
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {p.done}/{p.total}
                  </span>
                )}
              </Link>
            );
          })}
          {tracks?.length === 0 && (
            <p className="px-2.5 text-sm text-muted-foreground">No tracks yet</p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 pt-6">
          <NavLink to="/settings">Settings</NavLink>
          <button
            type="button"
            onClick={() => client?.auth.signOut()}
            className="rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Sign out
          </button>
          <p className="mt-2 truncate px-2.5 text-xs text-muted-foreground">
            {session?.user.email}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-10 py-10">{children}</div>
    </div>
  );
}
