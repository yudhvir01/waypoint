# Waypoint

**One Dashboard. Every Goal.**

Waypoint is one dashboard for everything you're learning and building. Instead of digging through a dozen notes to remember what you're supposed to be doing today, you get one ranked list: what's overdue, what's urgent, and what's next — across every track you're working on.

There's no shared backend. Every user connects their own [Supabase](https://supabase.com) project, so tracks, topics, and tasks never touch a server you don't control.

## How it's different

Most note apps give you a blank page and a thousand templates. Waypoint gives you three things and nothing else:

- **Tracks** — a subject you're working on (C++, Robotics, Interview Prep, a side project — whatever you're actually juggling).
- **Topics** — a unit inside a track (e.g. "Pointers", "ROS basics"), with a status: not started, in progress, or done.
- **Tasks** — the actual next actions inside a topic, each with an optional priority and due date.

Everything rolls up into one **Focus Now** list on the dashboard: the tasks that most need your attention, ranked by what's overdue, what's due soon, and priority — blended across every active track.

## Features

- **Bring-your-own-database connect flow** — paste a Supabase project ID and anon key; Waypoint derives the project URL, verifies the schema, and never sends your credentials anywhere else. Config lives only in `localStorage`.
- **Tracks / Topics / Tasks** with row-level security — every row is scoped to `auth.uid()`, so a user can only ever see their own data.
- **Focus Now** — overdue tasks first, then due-within-2-days, then by priority, sorted by due date within each tier.
- **Markdown import** — write a whole track as `# Track / ## Topic / - [ ] Task #priority:high #due:2026-09-10` and import it in one shot, with a preview and non-fatal warnings for anything it can't parse. See [`docs/writebook/03-the-markdown-import-format.md`](docs/writebook/03-the-markdown-import-format.md).
- **Email & push reminders** — a Supabase Edge Function checks overdue/due-soon tasks daily and notifies by email (Resend) and/or browser push (Web Push + VAPID), per user preference. See [`docs/writebook/04-reminders.md`](docs/writebook/04-reminders.md).
- **In-app guide** at `/guide` — a sidebar-nav walkthrough of setup and every feature, so the docs ship with the app.
- **Installable PWA** with light/dark theming, including a custom service worker for push notifications.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project and run the setup script

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in the contents of [`supabase/setup.sql`](./supabase/setup.sql), and run it. This creates every table the app needs (`tracks`, `topics`, `tasks`, `push_subscriptions`, `reminder_prefs`) and locks them down with row-level security so only you can read or write your own data.
3. Grab your **Project ID** (Settings → General) and **anon key** (Settings → API Keys).

The full walkthrough — including how to skip Supabase's email confirmation for a personal, single-user setup — lives in [`docs/writebook/02-connecting-your-supabase-project.md`](./docs/writebook/02-connecting-your-supabase-project.md), also served in-app at `/guide`.

### 3. Run the app

```bash
npm run dev
```

Open the app and paste in your Project ID and anon key when prompted.

### 4. (Optional) Set up reminders

Reminders are entirely optional — the rest of the app works fine without them. If you want daily email/push nudges about overdue and due-soon tasks, it needs a one-time deploy of a Supabase Edge Function plus a Resend account. Full steps, including exact secret values, are in [`docs/writebook/04-reminders.md`](./docs/writebook/04-reminders.md).

## Scripts

| Command           | Description                        |
| ------------------ | ----------------------------------- |
| `npm run dev`       | Start the Vite dev server            |
| `npm run build`     | Type-check and build for production  |
| `npm run preview`   | Preview the production build locally |
| `npm run lint`      | Run Oxlint                           |

## Tech stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Postgres, Auth, row-level security, Edge Functions, `pg_cron`)
- [TanStack Query](https://tanstack.com/query) for data fetching
- [React Router](https://reactrouter.com)
- [Resend](https://resend.com) for reminder emails
- [Web Push](https://web.dev/push-notifications-overview/) (VAPID) for browser push, via a custom service worker built with [Workbox](https://developer.chrome.com/docs/workbox)
- Installable as a PWA via [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (`injectManifest` strategy)

## Project structure

```
src/
  components/
    Logo.tsx                 Theme-aware logo/wordmark lockup
    ImportMarkdownDialog.tsx Markdown import preview + confirm modal
    ThemeToggle.tsx           Light/dark/system theme switcher
    RequireConfig.tsx         Route guards (config connected, authed, etc.)
  context/
    SupabaseProvider.tsx      Holds the connected Supabase client + session
    ThemeProvider.tsx         Light/dark theme state
  hooks/
    useTracks.ts / useTopics.ts / useTasks.ts   CRUD queries + mutations
    useFocusNow.ts             Focus Now ranking query
    useImportTrack.ts          Bulk insert for Markdown import
    useReminderPrefs.ts        Per-user email/push toggle state
    usePushSubscription.ts     Browser push subscribe/unsubscribe
  lib/
    supabaseClient.ts / supabaseConfig.ts   Client creation + localStorage config
    markdownImport.ts          Markdown → track/topic/task parser
    push.ts                    Web Push subscription helpers, VAPID public key
    database.types.ts          Track/Topic/Task types
  pages/
    Connect.tsx    Supabase project connect screen
    Login.tsx      Sign up / log in
    Dashboard.tsx  Focus Now + Tracks list
    TrackDetail.tsx Topics + tasks for one track
    Settings.tsx   Reminders preferences + push enable/disable
    Guide.tsx      In-app docs, sidebar nav
  sw.ts            Custom service worker (push + notificationclick handlers)
supabase/
  setup.sql              One-time schema + RLS setup for your Supabase project
  reminders-cron.sql     Schedules the reminder function via pg_cron
  functions/
    send-reminders/      Edge Function: daily email/push reminder job
docs/
  writebook/       In-app guide content, served at /guide
```

## Status

All four planned phases are built and verified against a live Supabase project:

1. **Connect & Auth** — bring-your-own-database flow, row-level security.
2. **Tracks, Topics, Tasks & Focus Now** — the core tracking model.
3. **Markdown import** — bulk-create a track from a `.md` file.
4. **Reminders** — daily email/push notifications via a Supabase Edge Function.

Reminders need a one-time manual deploy (Edge Function + secrets + `pg_cron` schedule) — see [`docs/writebook/04-reminders.md`](./docs/writebook/04-reminders.md) for exact steps.
