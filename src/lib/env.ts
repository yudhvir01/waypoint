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

// Google sign-in for the Drive backend. Both pieces here are meant to be
// public: the client ID identifies the app to Google (like a Supabase
// project's URL), and the relay URL is just an API endpoint — neither
// one is a credential. The actual secret (GOOGLE_CLIENT_SECRET) lives
// only in that relay function's Supabase secrets; see
// supabase/functions/google-token.
export const GOOGLE_CLIENT_ID: string | null = import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
export const GOOGLE_TOKEN_RELAY_URL: string | null =
  import.meta.env.VITE_GOOGLE_TOKEN_RELAY_URL || null;

// Google sign-in is only offered when both are configured — a build that
// leaves these unset just doesn't show the option (same pattern as the
// Supabase default project).
export const GOOGLE_SIGNIN_ENABLED = GOOGLE_CLIENT_ID !== null && GOOGLE_TOKEN_RELAY_URL !== null;

// Link previews need the same kind of decoupling from "whichever backend
// this person happens to be on" that Google sign-in's token relay has:
// a guest or Google Drive user has no connected Supabase project at all,
// so tying the preview fetch to "the active project" would mean only
// Supabase-mode users (with their own project, and the function deployed
// to it) ever see one. Set explicitly via VITE_LINK_PREVIEW_URL to point
// every user at one shared deployment regardless of their storage
// backend; falling back to the baked-in default project's own function
// (if there is one) covers the common case without needing a second
// deployment target just for this. A Supabase-mode user with neither of
// those configured still gets previews if they deploy the function to
// their own project — see noteAttachments.tsx's fallback.
export const LINK_PREVIEW_URL: string | null =
  import.meta.env.VITE_LINK_PREVIEW_URL ||
  (DEFAULT_SUPABASE_CONFIG ? `${DEFAULT_SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/link-preview` : null);
