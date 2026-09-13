// Supabase Edge Function: google-token
//
// A stateless relay between the browser and Google's OAuth token
// endpoint. Its only reason to exist is that Google's client *secret*
// must never reach the browser, but everything else in this flow is
// fine to hand to the client directly:
//
//   - the authorization code exchange happens once, right after Google
//     redirects back to /auth/google/callback with a `code`
//   - the resulting refresh_token is handed straight back to the
//     browser, which stores it itself (IndexedDB, alongside the guest
//     backend's data) — this function keeps no state and no database,
//     so there's nothing here to leak, back up, or clean up later
//   - later, when an access_token expires (~1 hour), the browser sends
//     its stored refresh_token back here to mint a new one
//
// Deploy with `--no-verify-jwt`: this has to be callable before a user
// has any Supabase session (Drive sign-in doesn't require Supabase at
// all), so Supabase's own gateway auth would only get in the way. The
// endpoint is safe to leave open — without a valid `code` or
// `refresh_token` from Google, and without the secret this function
// holds, there is nothing a caller can do with it.
//
//   supabase functions deploy google-token --no-verify-jwt
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   GOOGLE_CLIENT_ID      — same value as VITE_GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET  — from the same OAuth client, never exposed client-side

const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface ExchangeRequest {
  grant_type: "authorization_code";
  code: string;
  redirect_uri: string;
}

interface RefreshRequest {
  grant_type: "refresh_token";
  refresh_token: string;
}

type TokenRequest = ExchangeRequest | RefreshRequest;

function isValidRequest(body: unknown): body is TokenRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.grant_type === "authorization_code") {
    return typeof b.code === "string" && typeof b.redirect_uri === "string";
  }
  if (b.grant_type === "refresh_token") {
    return typeof b.refresh_token === "string";
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!clientId || !clientSecret) {
    return json({ error: "server_misconfigured", message: "GOOGLE_CLIENT_ID/SECRET not set" }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!isValidRequest(body)) {
    return json({ error: "invalid_request" }, 400);
  }

  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  if (body.grant_type === "authorization_code") {
    params.set("grant_type", "authorization_code");
    params.set("code", body.code);
    params.set("redirect_uri", body.redirect_uri);
  } else {
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", body.refresh_token);
  }

  const googleRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await googleRes.json();

  if (!googleRes.ok) {
    // Google's error shape ({error, error_description}) is passed
    // straight through — it's already safe to show ("invalid_grant" for
    // an expired/used code, etc.) and doesn't include the secret.
    return json(data, googleRes.status);
  }

  // A refresh grant doesn't return a new refresh_token — Google expects
  // the caller to keep reusing the original one. The browser already has
  // it, so there's nothing missing here; it's just not re-sent.
  return json({
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token, // present only on the first, authorization_code exchange
    scope: data.scope,
  });
});
