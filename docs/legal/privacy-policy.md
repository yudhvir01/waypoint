---
title: Privacy Policy
---
# Privacy Policy

**Effective date:** September 14, 2026

This policy explains what Waypoint does with your information, and — because
that's most of the point of the app — where your data actually lives
depending on which option you pick when you sign in.

## The short version

Waypoint gives you three ways to store your tracks, topics, and tasks, and
each one has a different privacy story:

- **Guest** — nothing ever leaves your browser. There is no server involved
  at all.
- **Supabase** — your data lives in a Postgres database. If you connect your
  own Supabase project, only you can read it. If you use a database we
  operate as a convenience default, we can technically access it as the
  project owner, though the app itself never displays or uses your data for
  anything beyond running the app for you.
- **Google Drive** — your data lives as one file in a folder named
  "Waypoint" inside your own Google Drive. We never see its contents.

The rest of this page goes through each of these, plus the smaller pieces
(sign-in, reminders, analytics) in more detail.

## Information stored per sign-in option

### Guest mode

Guest mode stores everything — tracks, topics, tasks — in your browser's
IndexedDB. This data is never transmitted anywhere; we have no way to see it,
back it up, or recover it if you clear your browser's storage. It does not
sync between devices or browsers.

### Supabase

When you connect a Supabase project (your own, or a default one we may
offer), Waypoint stores your tracks, topics, tasks, and notification
preferences in that project's Postgres database, and creates an account for
you there using Supabase's own authentication (email and password).

- **Your own project:** the database is entirely under your control. We
  never have credentials for it and cannot access your data.
- **A project we operate:** we control the underlying infrastructure and
  could technically query the database directly, the same as any database
  administrator could for any application. We don't do this except to
  maintain the service or respond to a legal obligation. Row-level security
  is enabled so that, through the app itself, you can only ever see your own
  rows — no other user's data is ever exposed to you, or to another user.

If you enable **email or push reminders**, a scheduled server-side job reads
your open tasks' due dates once a day to decide whether to notify you. That
job runs against whichever Supabase project you're connected to.

- **Email reminders** are sent through [Resend](https://resend.com). The
  email address used is the one tied to your Supabase account. Resend
  processes the message on our behalf and is subject to its own privacy
  policy.
- **Push reminders** are delivered via the Web Push standard. Enabling this
  stores a push subscription (an endpoint URL and encryption keys — not
  personally identifying on its own) tied to your account, so a notification
  can be delivered to that specific browser.

### Google Drive

Signing in with Google uses the `drive.file` scope, not full Drive access —
Waypoint can only see or modify files it creates itself (a "Waypoint" folder,
and one JSON file inside it holding your tracks, topics, and tasks). It has
no visibility into anything else in your Drive, ever.

To keep you signed in without asking you to log in every hour, Waypoint
requests **offline access** from Google, which returns a refresh token. That
refresh token is stored in your browser's IndexedDB — not on any server we
operate — and is sent, only when a fresh access token is needed, to a small
server-side function whose only job is exchanging it with Google for a new
access token. That function:

- holds the Google API client secret (which must never be exposed in a
  browser), and
- does not store your refresh token, your access token, or any Drive file
  content — it passes the exchange through to Google and immediately
  forgets it.

We — the people operating Waypoint — never see the contents of your Drive
file at any point in this flow. Only your browser and Google's servers ever
handle that data directly.

### Account identity from Google sign-in

To show "who's signed in" in the app, we request your Google **email**,
**basic profile**, and **OpenID identity** at sign-in. This is used only to
display your account and is not stored anywhere beyond your own browser.

## Local storage Waypoint uses regardless of sign-in option

Independent of which backend you're on, your browser holds a few small
pieces of state that never leave it:

- **Theme preference** (light/dark/system) and the last-used Supabase
  connection details, in `localStorage`.
- **A guest-mode banner dismissal flag** and OAuth anti-forgery tokens
  (single-use, discarded immediately after sign-in), in `sessionStorage`.
- Guest data and a Google Drive refresh token, in `IndexedDB`, as described
  above.

None of this is transmitted to us. Clearing your browser's site data removes
all of it.

## Analytics

Waypoint uses [Vercel Analytics](https://vercel.com/analytics) to understand
aggregate traffic (page views, rough visitor counts) to this site. It is
configured to be privacy-friendly — it does not use cookies and does not
track you individually across sites. We use it only in aggregate, and never
to identify or profile a specific person.

## Third parties this data passes through

| Service | What it sees | Why |
|---|---|---|
| [Supabase](https://supabase.com/privacy) | Your account and app data, if you use Supabase | Database, authentication |
| [Google](https://policies.google.com/privacy) | Your Drive file, if you use Google sign-in; your email/name at sign-in | Storage, identity |
| [Resend](https://resend.com/legal/privacy-policy) | Your email address and reminder content, if email reminders are on | Sending reminder emails |
| [Vercel](https://vercel.com/legal/privacy-policy) | Aggregate, anonymous traffic data | Hosting, analytics |

We do not sell your data, and we do not share it with anyone beyond what's
listed above and what's needed to run the app.

## Your choices and how to remove your data

- **Guest:** clear your browser's site data for this domain, or use the
  in-app option to move to a different backend.
- **Supabase (your own project):** delete rows or drop the project yourself
  — you have full control.
- **Supabase (a project we operate):** contact us at the address below and
  we'll delete your account and its data.
- **Google Drive:** delete the "Waypoint" folder in your Drive, and revoke
  Waypoint's access at [myaccount.google.com → Security → Third-party
  access](https://myaccount.google.com/permissions). This also invalidates
  the refresh token stored in your browser.

## Children's privacy

Waypoint is not directed at children under 13, and we do not knowingly
collect information from them.

## Changes to this policy

If this policy changes in a way that matters, we'll update the effective
date above. Continuing to use Waypoint after a change means you accept the
update.

## Contact

Questions about this policy, or a request to delete data from a
Waypoint-operated project: **syudhvir14@gmail.com**
