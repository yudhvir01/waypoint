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
      className={`rounded-md px-3 py-1.5 text-[15px] transition-colors ${
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
    <div className="mx-auto flex min-h-screen max-w-6xl">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card px-5 py-7">
        <Link to="/" className="flex items-center gap-2.5 px-1">
          <LogoMark size={26} />
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
          <Link
            to="/archived"
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            Archived
          </Link>
        </div>

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
            onClick={() => client?.auth.signOut()}
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
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
