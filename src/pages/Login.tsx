import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabase } from "../context/SupabaseProvider";
import { Logo } from "../components/Logo";

export function Login() {
  const { client, disconnect } = useSupabase();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);

    if (mode === "login") {
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        navigate("/", { replace: true });
      }
    } else {
      const { error: signUpError } = await client.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setInfo("Account created. Check your email to confirm, then log in.");
        setMode("login");
      }
    }

    setSubmitting(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size={40} tagline className="mb-8" />

      <h1 className="text-2xl font-semibold">
        {mode === "login" ? "Log in" : "Create your account"}
      </h1>

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
          {submitting
            ? "Please wait..."
            : mode === "login"
              ? "Log in"
              : "Sign up"}
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
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Log in"}
      </button>

      <button
        type="button"
        onClick={disconnect}
        className="mt-8 text-xs text-muted-foreground hover:underline"
      >
        Connect a different Supabase project
      </button>
    </div>
  );
}
