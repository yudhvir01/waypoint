---
title: Setting Up Google Sign-In
---
# Setting Up Google Sign-In

Signing in with Google saves your tracks as one file in a "Waypoint" folder in
your own Google Drive. Like the Supabase option, this is one-time setup for
whoever is deploying the app — anyone who signs in afterward just clicks
"Sign in with Google", nothing more.

If you'd rather skip this, guest mode and Supabase both work without it.

## Why this needs more than an API key

Supabase's anon key is safe to put straight into the app because row-level
security does the actual protecting. Google's OAuth **client secret** is
different — anyone holding it could mint tokens as your app, so it can never
ship in the browser bundle. That's the one piece here that needs a server,
even though Waypoint otherwise has none: a small, stateless Supabase Edge
Function holds the secret and does nothing else. It stores no data of its
own — the refresh token it hands back is kept in the browser, in IndexedDB,
the same way a guest's tracks are.

## 1. Create a Google Cloud OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create (or pick) a project.
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: External (unless everyone using this is in your Google
     Workspace org).
   - Add the `drive.file` scope (per-file access only — the app can never
     see anything in your Drive besides what it creates itself) plus
     `email` and `profile`.
   - While in **Testing** status you can add up to 100 test users with no
     verification review needed — fine for personal or small-group use.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → **Web application**.
   - **Authorized JavaScript origins**: every origin the app runs on, e.g.
     `https://waypoint.example.com` and `http://localhost:5173`. Origin
     only — no path, no trailing slash.
   - **Authorized redirect URIs**: the full callback path on each of those
     same origins, e.g. `https://waypoint.example.com/auth/google/callback`
     and `http://localhost:5173/auth/google/callback`.
5. Copy the **Client ID** and **Client secret** from this credential.

## 2. Deploy the token-relay Edge Function

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy google-token --no-verify-jwt
```

`--no-verify-jwt` matters here: this function has to be callable before
anyone has a Supabase session (Drive sign-in doesn't require Supabase at
all), so Supabase's own gateway auth would only get in the way. The
function is safe to leave open — see its header comment in
`supabase/functions/google-token/index.ts` for why.

Set two secrets on whichever project you deployed it to (it doesn't need to
be the same project as your tracks/topics/tasks data, or the reminders
function — its only job is this token exchange):

| Secret | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | From step 1 |
| `GOOGLE_CLIENT_SECRET` | From step 1 — never put this one in the app itself |

## 3. Point the app at it

Set these as build-time env vars (e.g. in Vercel's project settings) —
both are safe to expose, same as `VITE_SUPABASE_ANON_KEY`:

```bash
VITE_GOOGLE_CLIENT_ID=<the client id from step 1>
VITE_GOOGLE_TOKEN_RELAY_URL=https://<project-ref>.supabase.co/functions/v1/google-token
```

Leave either unset and the "Sign in with Google" button shows as disabled
("Coming soon") instead of failing at sign-in time.

## What it looks like once it's live

Someone clicking "Sign in with Google" is sent to Google's consent screen,
then straight back into Waypoint signed in — no popups. Behind the scenes,
the app asked for offline access, so it holds onto a refresh token
(in IndexedDB, on that device) and quietly renews its access token through
the relay whenever the old one's about to expire, roughly once an hour.
There's nothing to re-authorize unless that refresh token itself is
revoked — from Google's side (myaccount.google.com → Security → Third-party
access) or by signing out in Waypoint.
