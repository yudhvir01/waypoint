import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useBackend } from "../context/BackendProvider";
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />
    </svg>
  );
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { mode, ownerLabel, signOut } = useBackend();
  const { data: tracks } = useTracks();
  const { data: progress } = useTrackProgress();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(
    () => sessionStorage.getItem("waypoint.guestBannerDismissed") === "1",
  );

  return (
    <div className="flex min-h-screen flex-col">
      {mode === "guest" && !guestBannerDismissed && (
        // The app's fixed-position hamburger (mobile) and theme toggle
        // (all sizes) both float in the top corners at all times — a
        // fixed element paints over whatever's underneath rather than
        // making room for it, so this banner has to reserve that space
        // itself with padding, or its text silently renders behind them.
        <div className="flex items-center justify-center gap-3 border-b border-amber-500/30 bg-amber-500/10 py-2 pl-16 pr-28 text-center text-xs text-amber-700 md:pl-4 dark:text-amber-400">
          <span>
            You're in guest mode — your tracks live only in this browser and can be lost if you
            clear its data.{" "}
            <Link to="/settings" className="font-medium underline underline-offset-2">
              Move to Supabase
            </Link>{" "}
            to keep them safe.
          </span>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("waypoint.guestBannerDismissed", "1");
              setGuestBannerDismissed(true);
            }}
            aria-label="Dismiss for now"
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Below md there's no room for a permanent sidebar, so it becomes
          an off-canvas drawer — this is what opens it. Sits opposite the
          global ThemeToggle (top-right) rather than sharing a corner
          with it. */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open menu"
        className="fixed left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm md:hidden"
      >
        <MenuIcon />
      </button>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-border bg-card px-5 py-7 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 ${
            mobileNavOpen ? "translate-x-0" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 px-1" onClick={() => setMobileNavOpen(false)}>
              <LogoMark size={24} />
              <span className="text-[17px] font-semibold tracking-tight">Waypoint</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground md:hidden"
            >
              ✕
            </button>
          </div>

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
              {mode === "guest" ? "Exit guest mode" : "Sign out"}
            </button>
            <p className="mt-2 truncate px-3 text-xs text-muted-foreground">{ownerLabel}</p>
            <div className="mt-1 flex gap-3 px-3 text-xs text-muted-foreground/60">
              <Link to="/privacy" className="hover:text-muted-foreground hover:underline">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-muted-foreground hover:underline">
                Terms of Service
              </Link>
            </div>
          </div>
        </aside>

        {/* Extra top clearance below md, where the page has no sidebar to
            push content past the fixed hamburger + theme toggle sitting
            in the top corners — without it, a page's own heading renders
            underneath them instead of below. */}
        <div className="min-w-0 flex-1 px-4 pb-8 pt-16 sm:px-6 sm:pb-10 sm:pt-14 md:px-14 md:py-12">
          <div className={`mx-auto ${wide ? "max-w-3xl" : "max-w-2xl"}`}>{children}</div>
        </div>
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
            <h2 className="text-[15px] font-semibold">
              {mode === "guest" ? "Exit guest mode?" : "Sign out?"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "guest"
                ? "Your guest tracks stay in this browser — coming back to guest mode here will show them again. They won't follow you to another device or browser."
                : `You'll need to log back in with ${ownerLabel} to see your tracks.`}
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
                onClick={() => signOut()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                {mode === "guest" ? "Exit guest mode" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
