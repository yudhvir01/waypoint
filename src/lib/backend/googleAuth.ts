import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_TOKEN_RELAY_URL } from "../env";
import { clearDriveSession, loadDriveSession, saveDriveSession } from "./driveAuthStore";

// drive.file: the app can only see/create files it makes itself (or that
// a person explicitly opens with it) — never the rest of someone's
// Drive. email/profile/openid are just for showing who's signed in.
const SCOPES = "https://www.googleapis.com/auth/drive.file email profile openid";

const STATE_KEY = "waypoint.googleOAuthState";

// Set by Settings before redirecting to Google when migrating guest data
// (rather than signing in fresh) — checked by GoogleCallback once the
// redirect comes back, so it can send the browser to Settings' import
// dialog instead of the dashboard. One-time use, like STATE_KEY.
const GOOGLE_MIGRATION_KEY = "waypoint.googleMigration";

// A native app can be evicted from memory while the system browser owns
// the screen. localStorage survives that cold start; sessionStorage is
// preferable on the web because it keeps simultaneous tabs isolated.
function oauthStorage(): Storage {
  return Capacitor.isNativePlatform() ? localStorage : sessionStorage;
}

export function markGoogleMigration(): void {
  oauthStorage().setItem(GOOGLE_MIGRATION_KEY, "1");
}

export function clearGoogleMigration(): void {
  oauthStorage().removeItem(GOOGLE_MIGRATION_KEY);
}

export function consumeGoogleMigration(): boolean {
  const shouldResume = oauthStorage().getItem(GOOGLE_MIGRATION_KEY) === "1";
  clearGoogleMigration();
  return shouldResume;
}

export function googleRedirectUri(): string {
  if (Capacitor.isNativePlatform()) {
    if (!GOOGLE_REDIRECT_URI?.startsWith("https://")) {
      throw new Error(
        "Google sign-in on mobile needs VITE_GOOGLE_REDIRECT_URI set to an HTTPS App Link.",
      );
    }
    return GOOGLE_REDIRECT_URI;
  }
  return `${window.location.origin}/auth/google/callback`;
}

// access_type=offline + prompt=consent are what make Google hand back a
// refresh_token at all — without both, a returning user only gets a
// short-lived access_token and would need a Google popup again every
// hour. Consent is asked every time on purpose: it's the only way this
// (secret-free, storage-free) relay can be sure a refresh_token comes
// back, since Google otherwise only issues one on a user's *first-ever*
// consent for this app.
export function buildGoogleAuthUrl(): string {
  if (!GOOGLE_CLIENT_ID) throw new Error("Google sign-in is not configured.");
  const state = crypto.randomUUID();
  oauthStorage().setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function startGoogleSignIn(): Promise<void> {
  const url = buildGoogleAuthUrl();
  if (Capacitor.isNativePlatform()) {
    // Google forbids OAuth in embedded WebViews. Capacitor Browser uses a
    // secure system browser surface (Custom Tabs / SFSafariViewController).
    await Browser.open({ url });
    return;
  }
  window.location.assign(url);
}

// One-time use: cleared as soon as it's checked, whether or not it
// matched, so a replayed callback URL can't be verified twice.
export function consumeGoogleOAuthState(receivedState: string | null): boolean {
  const expected = oauthStorage().getItem(STATE_KEY);
  oauthStorage().removeItem(STATE_KEY);
  return !!expected && !!receivedState && expected === receivedState;
}

interface RelayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface RelayErrorResponse {
  error: string;
  error_description?: string;
  message?: string;
}

async function callRelay(body: object): Promise<RelayTokenResponse> {
  if (!GOOGLE_TOKEN_RELAY_URL) throw new Error("Google sign-in is not configured.");
  const res = await fetch(GOOGLE_TOKEN_RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as RelayTokenResponse | RelayErrorResponse;
  if (!res.ok) {
    const err = data as RelayErrorResponse;
    throw new Error(err.error_description || err.message || err.error || "Google sign-in failed.");
  }
  return data as RelayTokenResponse;
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Couldn't read your Google account's email.");
  const info = (await res.json()) as { email?: string };
  return info.email ?? "Google account";
}

// Completes the flow after Google redirects back to /auth/google/callback
// with a `code`. Exchanges it via the relay, stores the resulting
// refresh_token, and returns an active session ready to use.
export async function completeGoogleSignIn(code: string): Promise<GoogleDriveSession> {
  const tokens = await callRelay({
    grant_type: "authorization_code",
    code,
    redirect_uri: googleRedirectUri(),
  });
  if (!tokens.refresh_token) {
    // Happens if Google decided not to re-issue one (e.g. consent was
    // skipped some other way) — without it there's nothing to persist
    // past this access_token's ~hour, so treat it as a hard failure
    // rather than a session that silently stops working later.
    throw new Error("Google didn't grant offline access — try signing in again.");
  }
  const email = await fetchGoogleEmail(tokens.access_token);
  await saveDriveSession(email, tokens.refresh_token);
  return new GoogleDriveSession(email, tokens.refresh_token, tokens.access_token, tokens.expires_in);
}

// Rebuilds a session from whatever's already saved — used on every app
// load so a Drive sign-in survives a reload the same way a Supabase
// session does.
export async function restoreGoogleSignIn(): Promise<GoogleDriveSession | null> {
  const saved = await loadDriveSession();
  if (!saved) return null;
  return new GoogleDriveSession(saved.email, saved.refreshToken, null, 0);
}

export async function signOutOfGoogle(): Promise<void> {
  await clearDriveSession();
}

// Holds the short-lived access_token in memory and refreshes it through
// the relay on demand — the refresh_token is the only part that's ever
// persisted. Safety margin on the expiry check so a token doesn't expire
// mid-request on a slow connection.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export class GoogleDriveSession {
  readonly email: string;
  private readonly refreshToken: string;
  private accessToken: string | null;
  private accessTokenExpiresAt: number;

  constructor(email: string, refreshToken: string, accessToken: string | null, expiresInSeconds: number) {
    this.email = email;
    this.refreshToken = refreshToken;
    this.accessToken = accessToken;
    this.accessTokenExpiresAt = accessToken ? Date.now() + expiresInSeconds * 1000 : 0;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - EXPIRY_SAFETY_MARGIN_MS) {
      return this.accessToken;
    }
    const tokens = await callRelay({ grant_type: "refresh_token", refresh_token: this.refreshToken });
    this.accessToken = tokens.access_token;
    this.accessTokenExpiresAt = Date.now() + tokens.expires_in * 1000;
    return this.accessToken;
  }
}
