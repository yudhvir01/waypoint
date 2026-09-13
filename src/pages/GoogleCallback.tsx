import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useBackend } from "../context/BackendProvider";
import { completeGoogleSignIn, consumeGoogleOAuthState } from "../lib/backend/googleAuth";

// Where Google sends the browser back to after the consent screen (see
// googleRedirectUri() — this path has to match what's registered as an
// Authorized redirect URI in the Google Cloud console exactly). Renders
// no real UI of its own: it exists to pull the `code` off the URL before
// anything else touches it, trade it for a session, and get out of the
// way — the code is only valid once, and browser back/refresh in the
// meantime would otherwise try to redeem it a second time.
export function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeGoogleSignIn: adoptSession } = useBackend();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = params.get("error");
    if (oauthError) {
      setError(
        oauthError === "access_denied"
          ? "Sign-in was cancelled."
          : `Google returned an error: ${oauthError}`,
      );
      return;
    }

    const code = params.get("code");
    if (!code || !consumeGoogleOAuthState(params.get("state"))) {
      setError("Couldn't verify this sign-in request — please try again.");
      return;
    }

    let cancelled = false;
    completeGoogleSignIn(code)
      .then((session) => {
        if (cancelled) return;
        adoptSession(session);
        navigate("/", { replace: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      });
    return () => {
      cancelled = true;
    };
    // Runs once against whatever the URL had on arrival — re-running this
    // on param changes would try to redeem the same one-time code again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={40} tagline className="mb-8" />
      {error ? (
        <>
          <h1 className="text-2xl font-semibold">Couldn't sign you in</h1>
          <p className="mt-2 text-sm text-destructive">{error}</p>
          <Link to="/login" className="mt-6 text-sm text-primary hover:underline">
            ← Back to login
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      )}
    </div>
  );
}
