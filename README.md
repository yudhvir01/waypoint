# Waypoint

**One Dashboard. Every Goal.**

Waypoint is one dashboard for everything you're learning and building. Instead of digging through a dozen notes to remember what you're supposed to be doing today, you get one ranked list: what's overdue, what's urgent, and what's next — across every track you're working on.

There's no backend Waypoint controls. Try it instantly as a guest (data stays in your browser), or connect it to your own [Supabase](https://supabase.com) project for a real account that works across devices. Every storage option lives behind one interface (`Backend`, in `src/lib/backend/`), so which one you're on never changes how a page works.

## How it's different

Most note apps give you a blank page and a thousand templates. Waypoint gives you three things and nothing else:

- **Tracks** — a subject you're working on (C++, Robotics, Interview Prep, a side project — whatever you're actually juggling).
- **Topics** — a unit inside a track (e.g. "Pointers", "ROS basics"), with a status: not started, in progress, or done.
- **Tasks** — the actual next actions inside a topic, each with an optional priority and due date.

Everything rolls up into one **Focus Now** list on the dashboard: the tasks that most need your attention, ranked by what's overdue, what's due soon, and priority — blended across every active track.

## Features

- **Three ways in** — try it as a guest with no account (data lives in this browser's IndexedDB only), connect your own Supabase project (paste a project ID and anon key, or bake one in via `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` so a deployment just works on every device), or sign in with Google (data lives as one file in a "Waypoint" folder in your own Drive — `drive.file` scope, so the app can never see anything else in your Drive). See [`docs/writebook/02-connecting-your-supabase-project.md`](docs/writebook/02-connecting-your-supabase-project.md).
- **Google sign-in needs one-time setup of your own**: a Google Cloud OAuth client, and a tiny stateless Supabase Edge Function (`supabase/functions/google-token`) that holds the OAuth client secret so it never reaches the browser — see that function's header comment for the exact steps and required secrets.
- **Guest → Supabase or Google Drive migration** — Settings offers a one-click "Move to Supabase"/"Move to Google Drive" for guest data: connect (or sign in), and every guest track is imported into the new account. Nothing local is touched unless you ask.
- **Tracks / Topics / Tasks** with row-level security — every row is scoped to `auth.uid()`, so a user can only ever see their own data.
- **Focus Now** — overdue tasks first, then due-within-2-days, then by priority, sorted by due date within each tier.
- **Search** — Ctrl/⌘+K from anywhere; tracks, topics, tasks and note text in one box, accent- and case-insensitive.
- **Review** — a look back: done this week vs. last, streaks, a 26-week activity grid, overdue ("slipped"), and topics/tracks that have gone quiet.
- **Repeating tasks** — daily, weekdays, weekly or monthly; ticking one creates the next occurrence (never in the past). `#repeat:` in Markdown.
- **Spaced revisit** — finishing a topic schedules review tasks at +3, +7 and +21 days in a per-track "Reviews" topic (toggle in Settings).
- **Manual task order** — Move up / Move down in a task's menu.
- **Quiet app updates** — installed Android apps fetch new web bundles in the background and use them on next launch, with automatic rollback; a new APK is only offered, never forced. See [`docs/mobile.md`](docs/mobile.md).
- **Focus timer** — a Pomodoro-style timer tied to a task, kept running across pages; time is logged per task and shown on the Review page.
- **Note links & backlinks** — `[[Title]]` links to a note, task, topic or track (Ctrl/Cmd+click to open); each note lists what it links to and what links back.
- **Quick add** — press `C` anywhere and write a line like `read ch 4 friday !high #cpp`; dates, repeats, priority and track are picked out of the text, and unsorted tasks land in an Inbox. Tasks can be moved between topics and tracks.
- **Flashcards from notes** — write `question :: answer` on a line of a note and it becomes a card; spaced review with a 20-card session cap.
- **Topic confidence** — rate a topic Shaky / Okay / Solid; it sets how soon reviews come back and feeds the Review page.
- **Gentle by design** — one rest day doesn't break a streak, overdue tasks can be cleared in one move, and open reviews are capped per track.
- **Export & restore** — a track as Markdown (round-trips with import), a full JSON backup, and a restore that adds a backup's contents as new rows.
- **Markdown import** — write a whole track as `# Track / ## Topic / - [ ] Task #priority:high #due:2026-09-10` and import it in one shot, with a preview and non-fatal warnings for anything it can't parse. See [`docs/writebook/03-the-markdown-import-format.md`](docs/writebook/03-the-markdown-import-format.md).
- **Image & audio attachments in notes** — insert a photo or a voice clip inline; each backend stores the file its own way (a Supabase Storage bucket, an IndexedDB blob for guest, a file in the Drive "Waypoint" folder) behind the same `uploadAttachment`/`resolveAttachmentUrl` pair on `Backend`.
- **Link previews on paste** — pasting a bare URL into a note swaps it for a Signal-style card (title, description, image), fetched server-side by `supabase/functions/link-preview` since most sites block a browser from reading their own `<head>` cross-origin. Works the same on every backend (guest, Drive, Supabase) once that function is deployed and reachable — see `VITE_LINK_PREVIEW_URL` below. Without a reachable deployment, pasted links still work, just as plain links.
- **In-app guide** at `/guide` — a sidebar-nav walkthrough of setup and every feature, so the docs ship with the app.
- **Installable PWA** with light/dark theming.
- **Native Android and iOS shells** through Capacitor 8, using the same React app and storage backends. See [`docs/mobile.md`](docs/mobile.md).

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project and run the setup script

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in the contents of [`supabase/setup.sql`](./supabase/setup.sql), and run it. This creates every table the app needs (`tracks`, `topics`, `tasks`, `topic_counts`), the indexes and helper functions the app's queries rely on, a public `attachments` Storage bucket for note images/audio, and locks it all down with row-level security so only you can read or write your own data.

   The script is safe to re-run. **Already running an older Waypoint?** Re-run it after pulling — it migrates an existing database in place (adding ownership columns, indexes, maintained progress counters, and the `recurrence` and `confidence` columns and the `cards` and `focus_sessions` tables) without touching your rows. Repeating tasks, topic confidence, flashcards, the focus timer's log and Focus Now need this re-run.
3. Grab your **Project ID** (Settings → General) and **anon key** (Settings → API Keys).
4. **(Optional) Deploy the link-preview function** so pasted links show a preview card: `supabase functions deploy link-preview --no-verify-jwt`. Nothing to configure — it's stateless and needs no secrets. Deploying it to the project behind `VITE_SUPABASE_URL` (the baked-in default, if you set one) makes it work for every visitor regardless of which backend they pick, guest and Google Drive included — those have no "connected project" of their own to reach a function through otherwise. Skip it and pasted links just stay plain links.

The full walkthrough — including how to skip Supabase's email confirmation for a personal, single-user setup — lives in [`docs/writebook/02-connecting-your-supabase-project.md`](./docs/writebook/02-connecting-your-supabase-project.md), also served in-app at `/guide`.

### 3. Run the app

```bash
npm run dev
```

Open the app — the login screen lets you try it as a guest immediately, or connect a Supabase project (paste your Project ID and anon key, or set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` beforehand so it's already connected).

## Scripts

| Command           | Description                        |
| ------------------ | ----------------------------------- |
| `npm run dev`       | Start the Vite dev server            |
| `npm run build`     | Type-check and build for production  |
| `npm run build:native` | Type-check and build native web assets without the PWA service worker |
| `npm run cap:sync` | Build and sync web assets/plugins into Android and iOS |
| `npm run cap:android` / `cap:ios` | Sync and open the corresponding native project |
| `npm run cap:run:android` / `cap:run:ios` | Sync, build, and run on a selected device or simulator |
| `npm run preview`   | Preview the production build locally |
| `npm run release:web` | Build and publish an over-the-air web update for installed apps |
| `npm run lint`      | Run Oxlint                           |

## Tech stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Postgres, Auth, row-level security, Edge Functions)
- [TanStack Query](https://tanstack.com/query) for data fetching
- [React Router](https://reactrouter.com)
- [Google Drive API](https://developers.google.com/drive) (`drive.file` scope) + [Google Identity](https://developers.google.com/identity) OAuth for the Drive backend
- Installable as a PWA via [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (`injectManifest` strategy, via a custom service worker built with [Workbox](https://developer.chrome.com/docs/workbox))
- [Capacitor 8](https://capacitorjs.com) for the Android and iOS application shells

## Project structure

```
src/
  components/
    Logo.tsx                 Theme-aware logo/wordmark lockup
    ImportMarkdownDialog.tsx Markdown import preview + confirm modal
    ThemeToggle.tsx           Light/dark/system theme switcher
    RouteGuards.tsx           RequireAuth / RedirectIfAuthed, keyed off Backend presence
    SupabaseAuthPanel.tsx     Shared "pick a project, then log in" panel (Login + migration)
    GuestMigrationDialog.tsx  Guest → Supabase/Drive one-click import
    NoteEditor.tsx            TipTap rich text editor: formatting, attachments, link previews
    noteAttachments.tsx       Custom TipTap nodes: image/audio attachments, link preview cards
  context/
    BackendProvider.tsx       Picks guest vs. Supabase, exposes the active Backend + session
    ThemeProvider.tsx         Light/dark theme state
  hooks/
    useTracks.ts / useTopics.ts / useTasks.ts   CRUD queries + mutations, backend-agnostic
    useFocusNow.ts             Focus Now ranking query
    useImportTrack.ts          Bulk insert for Markdown import
    useSnapshot.ts             Whole-account read behind search, review and export
  lib/
    backend/types.ts           The Backend interface every page talks through
    backend/supabaseBackend.ts Backend implementation over Postgres/PostgREST
    backend/guestBackend.ts    Backend implementation over IndexedDB (via `idb`)
    backend/guestStore.ts      IndexedDB schema + persistence request
    supabaseClient.ts / supabaseConfig.ts   Client creation + localStorage config
    env.ts                     Optional baked-in default Supabase project + LINK_PREVIEW_URL resolution (VITE_ env vars)
    markdownImport.ts          Markdown → track/topic/task parser
    linkPreview.ts             Client for the link-preview Edge Function
    recurrence.ts              Next-occurrence date math for repeating tasks
    taskActions.ts             Ticking a task: repeat follow-up + spaced reviews
    search.ts / insights.ts    Pure functions over a snapshot: search, streaks, review
    cards.ts                   Cards from note text, diffing, scheduler, daily session
    links.ts                   [[Title]] parsing, resolution and backlinks
    focusTimer.ts              The focus timer as pure functions over timestamps
    appUpdate.ts / otaUpdater.ts   Update manifest parsing and decisions; the native updater
    quickAdd.ts / inbox.ts     Parse one line into a task; where it lands (a track or the Inbox)
    exportData.ts              Track → Markdown, full JSON backup, file download
    backup.ts                  Validating reader for backup files
    database.types.ts          Track/Topic/Task types
  pages/
    Login.tsx      Landing screen: guest / Supabase / Google
    GoogleCallback.tsx  Handles Google's OAuth redirect back to the app
    Dashboard.tsx  Focus Now + Tracks list
    Search.tsx     Search across everything
    Review.tsx     Weekly review, streaks, activity grid
    Cards.tsx      Flashcard review session
    TrackDetail.tsx Topics + tasks for one track
    Settings.tsx   Database/migration status
    Guide.tsx      In-app docs, sidebar nav
  sw.ts            Custom service worker (precaches app assets)
supabase/
  setup.sql              One-time schema + RLS setup for your Supabase project
  functions/
    google-token/        Relay for the Drive OAuth token exchange
    link-preview/         Stateless URL-metadata fetcher for note link previews
docs/
  writebook/       In-app guide content, served at /guide
```

## Status

Core phases are built and verified against a live Supabase project, plus a local guest backend:

1. **Storage backends** — guest mode (IndexedDB, no account), Supabase (bring-your-own project or a baked-in default), and Google Drive (one JSON file in a "Waypoint" folder, via a stateless OAuth token-relay Edge Function), all behind one `Backend` interface. A "Move to Supabase"/"Move to Google Drive" flow migrates guest data in.
2. **Tracks, Topics, Tasks & Focus Now** — the core tracking model, on either backend.
3. **Markdown import** — bulk-create a track from a `.md` file.
4. **Note attachments & link previews** — images/audio embedded in a note's body on all three backends, and Signal-style link preview cards on paste (needs the `link-preview` Edge Function deployed; degrades to a plain link without it).
