import type { SupabaseConfig } from "./supabaseConfig";

// A project baked in at build time via VITE_ env vars, so a deployment
// (and every device that opens it) just works without anyone pasting a
// project ref and anon key in by hand. The anon key is meant to be
// public — Supabase ships it in every client bundle — so putting it here
// isn't a new exposure; RLS is what actually protects the data. Set these
// in Vercel (or wherever this is built) and leave them unset for a build
// that should only offer "bring your own project".
export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig | null = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
})();
