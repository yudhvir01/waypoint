import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBackend } from "../context/BackendProvider";
import { SupabaseAuthPanel } from "../components/SupabaseAuthPanel";
import { Logo } from "../components/Logo";
import { buildGoogleAuthUrl } from "../lib/backend/googleAuth";
import { GOOGLE_SIGNIN_ENABLED } from "../lib/env";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GuardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M9 1.5 15 4v4.2c0 4-2.6 6.7-6 8.3-3.4-1.6-6-4.3-6-8.3V4l6-2.5Z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <ellipse cx="9" cy="4" rx="6" ry="2.2" />
      <path d="M3 4v10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V4" />
      <path d="M3 9c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2" />
    </svg>
  );
}

type View = "landing" | "supabase";

export function Login() {
  const { loginAsGuest } = useBackend();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("landing");

  function handleGuest() {
    loginAsGuest();
    navigate("/", { replace: true });
  }

  function handleGoogle() {
    // A full-page redirect, not a popup — Google's OAuth code flow
    // (needed to get a refresh_token back through the relay) redirects
    // back to /auth/google/callback with the result rather than posting
    // a message to an opener window.
    window.location.href = buildGoogleAuthUrl();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={40} tagline className="mb-8" />

      {view === "supabase" ? (
        <SupabaseAuthPanel onConnected={() => navigate("/", { replace: true })} onCancel={() => setView("landing")} />
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Get started</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick where your tracks and tasks live. You can switch later without losing anything
            you've already stored with Supabase or Google.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setView("supabase")}
              className="flex items-center gap-3 rounded-md border border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-accent"
            >
              <DatabaseIcon />
              <span className="flex-1">
                Continue with Supabase
                <span className="block text-xs font-normal text-muted-foreground">
                  Your own database. Nothing is ever lost.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={GOOGLE_SIGNIN_ENABLED ? handleGoogle : undefined}
              disabled={!GOOGLE_SIGNIN_ENABLED}
              title={GOOGLE_SIGNIN_ENABLED ? undefined : "Coming soon"}
              className={`flex items-center gap-3 rounded-md border border-border px-4 py-3 text-left text-sm font-medium transition-colors ${
                GOOGLE_SIGNIN_ENABLED ? "hover:border-primary hover:bg-accent" : "opacity-50"
              }`}
            >
              <GoogleIcon />
              <span className="flex-1">
                Sign in with Google
                <span className="block text-xs font-normal text-muted-foreground">
                  Saves to a "Waypoint" folder in your Drive.
                  {!GOOGLE_SIGNIN_ENABLED && " Coming soon."}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={handleGuest}
              className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <GuardIcon />
              <span className="flex-1">
                Just try it as a guest
                <span className="block text-xs font-normal">No account — see what Waypoint can do first.</span>
              </span>
            </button>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Guest tracks are saved only in this browser. Clearing your browser data, or opening
            Waypoint on another device, means they're gone — sign in with Supabase or Google
            first if you'd rather not risk that.
          </p>
        </>
      )}

      <Link to="/guide" className="mt-8 text-center text-sm text-muted-foreground hover:underline">
        Read the Guide
      </Link>
      <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground/70">
        <Link to="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
