import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSupabase } from "../context/SupabaseProvider";
import { createSupabaseClient } from "../lib/supabaseClient";
import { Logo } from "../components/Logo";

// Accepts either a bare project ref (e.g. "qmhmosjgokreigmsaklx") or a full
// project URL (e.g. "https://qmhmosjgokreigmsaklx.supabase.co") pasted in by
// mistake, and normalizes either into just the ref.
function extractProjectRef(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  if (/^[a-z0-9]{10,40}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function Connect() {
  const { connect } = useSupabase();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const ref = extractProjectRef(projectId);
    const trimmedKey = anonKey.trim();

    if (!ref) {
      setError(
        "That doesn't look like a Supabase project ID (found under Settings → General in your project).",
      );
      return;
    }
    if (trimmedKey.length < 20) {
      setError("That anon key looks too short — double check you copied it fully.");
      return;
    }

    const trimmedUrl = `https://${ref}.supabase.co`;

    setChecking(true);
    try {
      const testClient = createSupabaseClient({ url: trimmedUrl, anonKey: trimmedKey });
      const { error: pingError } = await testClient
        .from("tracks")
        .select("id", { count: "exact", head: true });

      if (pingError) {
        setError(
          `Connected to Supabase, but couldn't find the app's tables (${pingError.message}). Did you run supabase/setup.sql in this project's SQL editor?`,
        );
        setChecking(false);
        return;
      }

      connect({ url: trimmedUrl, anonKey: trimmedKey });
      navigate("/login", { replace: true });
    } catch {
      setError("Couldn't reach that project. Check the URL and your network connection.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={40} tagline className="mb-8" />

      <h1 className="text-2xl font-semibold">Connect your Supabase project</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your notes live in your own Supabase project — never on our servers. Create a
        free project at{" "}
        <span className="font-medium text-foreground">supabase.com</span>, run the setup script from{" "}
        <code className="rounded bg-muted px-1 text-foreground">supabase/setup.sql</code> in
        its SQL editor, then paste your project details below.
      </p>

      <Link
        to="/guide#connecting-your-supabase-project"
        className="mt-3 text-sm text-primary hover:underline"
      >
        Read the full step-by-step guide →
      </Link>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Project ID
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="qmhmosjgokreigmsaklx"
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            required
          />
          <span className="text-xs text-muted-foreground">
            Found under Settings → General in your Supabase project (or the
            subdomain of your project URL).
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Anon (public) API key
          <input
            type="text"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOi..."
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            required
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={checking}
          className="mt-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {checking ? "Checking..." : "Connect"}
        </button>
      </form>
    </div>
  );
}
