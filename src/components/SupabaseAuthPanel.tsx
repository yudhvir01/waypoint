import { useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useBackend } from "../context/BackendProvider";
import { createSupabaseClient } from "../lib/supabaseClient";
import { extractProjectRef, type SupabaseConfig } from "../lib/supabaseConfig";

interface SupabaseAuthPanelProps {
  // Called once a real session exists and the app has switched into
  // Supabase mode — never called for a sign-up that's waiting on email
  // confirmation, since there's no session yet at that point.
  onConnected: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}

// Picking a project and logging into it, in one panel. Deliberately keeps
// its own Supabase client — separate from BackendProvider's — so testing
// a project or typing a password never touches the app's actual mode
// until sign-in truly succeeds. supabase-js persists the session to
// localStorage under a key derived from the project URL, so once this
// commits the project via selectSupabaseProject(), the client
// BackendProvider then creates for that same URL picks the session
// straight back up — no session needs to be threaded through by hand.
export function SupabaseAuthPanel({ onConnected, onCancel, cancelLabel = "← Back" }: SupabaseAuthPanelProps) {
  // Seeded from whatever the app already knows — the baked-in default
  // project, or a custom one saved from a previous session (e.g. someone
  // who signed out and came back). Without this, every sign-out would
  // force re-typing a project ref and anon key that were already on file.
  const { supabaseConfig, isCustomSupabaseProject, selectSupabaseProject } = useBackend();
  const [hadKnownProject] = useState(supabaseConfig !== null);
  const [subview, setSubview] = useState<"project" | "auth">(supabaseConfig ? "auth" : "project");
  const [config, setConfig] = useState<SupabaseConfig | null>(supabaseConfig);
  const [isCustom, setIsCustom] = useState(isCustomSupabaseProject);

  const client: SupabaseClient | null = useMemo(() => (config ? createSupabaseClient(config) : null), [config]);

  if (subview === "project" || !config) {
    return (
      <ProjectPanel
        showBackToDefault={hadKnownProject}
        onBack={hadKnownProject ? () => setSubview("auth") : onCancel}
        onConnected={(next) => {
          setConfig(next);
          setIsCustom(true);
          setSubview("auth");
        }}
      />
    );
  }

  return (
    <AuthFormPanel
      client={client!}
      onBack={onCancel}
      backLabel={cancelLabel}
      onUseDifferentProject={() => setSubview("project")}
      onSignedIn={() => {
        selectSupabaseProject(config, isCustom);
        onConnected();
      }}
    />
  );
}

function ProjectPanel({
  onConnected,
  onBack,
  showBackToDefault,
}: {
  onConnected: (config: SupabaseConfig) => void;
  onBack: () => void;
  showBackToDefault: boolean;
}) {
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

    const url = `https://${ref}.supabase.co`;

    setChecking(true);
    try {
      const testClient = createSupabaseClient({ url, anonKey: trimmedKey });
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

      onConnected({ url, anonKey: trimmedKey });
    } catch {
      setError("Couldn't reach that project. Check the URL and your network connection.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Connect your Supabase project</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your notes live in your own Supabase project — never on our servers. Create a
        free project at{" "}
        <span className="font-medium text-foreground">supabase.com</span>, run the setup script from{" "}
        <code className="rounded bg-muted px-1 text-foreground">supabase/setup.sql</code> in
        its SQL editor, then paste your project details below.
      </p>

      <a
        href="/guide#connecting-your-supabase-project"
        className="mt-3 inline-block text-sm text-primary hover:underline"
      >
        Read the full step-by-step guide →
      </a>

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

      <button type="button" onClick={onBack} className="mt-6 text-sm text-muted-foreground hover:underline">
        {showBackToDefault ? "← Back to login" : "← Back"}
      </button>
    </div>
  );
}

function AuthFormPanel({
  client,
  onSignedIn,
  onBack,
  backLabel,
  onUseDifferentProject,
}: {
  client: SupabaseClient;
  onSignedIn: () => void;
  onBack: () => void;
  backLabel: string;
  onUseDifferentProject: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    if (mode === "login") {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
      } else {
        onSignedIn();
      }
    } else {
      const { data, error: signUpError } = await client.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session) {
        // Email confirmation is off for this project — signUp already
        // returned a live session, so there's nothing left to wait on.
        onSignedIn();
      } else {
        setInfo("Account created. Check your email to confirm, then log in.");
        setMode("login");
      }
    }

    setSubmitting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            required
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-success">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setInfo(null);
        }}
        className="mt-4 text-sm text-primary hover:underline"
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>

      <div className="mt-8 flex flex-col gap-2">
        <button type="button" onClick={onUseDifferentProject} className="text-left text-xs text-muted-foreground hover:underline">
          Use a different Supabase project
        </button>
        <button type="button" onClick={onBack} className="text-left text-xs text-muted-foreground hover:underline">
          {backLabel}
        </button>
      </div>
    </div>
  );
}
