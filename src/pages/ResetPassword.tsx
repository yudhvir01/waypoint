import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useBackend } from "../context/BackendProvider";

// Where the "reset your password" email links to. Supabase's client reads
// the recovery session off the URL as it starts, so by the time this page
// asks, the person is signed in just far enough to set a new password.
export function ResetPassword() {
  const navigate = useNavigate();
  const { client, supabaseConfig, isCustomSupabaseProject, selectSupabaseProject } = useBackend();
  const [state, setState] = useState<"checking" | "ready" | "invalid">(client ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setState("ready");
    });
    client.auth.getSession().then(({ data }) => {
      if (active) setState((s) => (data.session ? "ready" : s === "checking" ? "invalid" : s));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!client || !supabaseConfig) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    selectSupabaseProject(supabaseConfig, isCustomSupabaseProject);
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <Logo />
      {state === "checking" && <p className="mt-8 text-sm text-muted-foreground">Checking your link…</p>}

      {state === "invalid" && (
        <>
          <h1 className="mt-8 text-2xl font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reset links work once and only for a short while. Ask for a new one from the login page.
          </p>
          <Link to="/login" className="mt-6 text-sm text-primary hover:underline">
            Go to login
          </Link>
        </>
      )}

      {state === "ready" && (
        <>
          <h1 className="mt-8 text-2xl font-semibold">Choose a new password</h1>
          <form onSubmit={save} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              New password
              <input
                type="password"
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save and continue"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
