import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSupabase } from "../context/SupabaseProvider";
import { createSupabaseClient } from "../lib/supabaseClient";
import { Logo } from "../components/Logo";

export function Connect() {
  const { connect } = useSupabase();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim().replace(/\/+$/, "");
    const trimmedKey = anonKey.trim();

    if (!/^https:\/\/.+\.supabase\.co$/.test(trimmedUrl)) {
      setError(
        "That doesn't look like a Supabase project URL (expected https://xxxx.supabase.co).",
      );
      return;
    }
    if (trimmedKey.length < 20) {
      setError("That anon key looks too short — double check you copied it fully.");
      return;
    }

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
          Project URL
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxxxxx.supabase.co"
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            required
          />
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
