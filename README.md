# Waypoint

**One Dashboard. Every Goal.**

Waypoint is one dashboard for everything you're learning and building. Instead of digging through a dozen notes to remember what you're supposed to be doing today, you get one ranked list: what's overdue, what's urgent, and what's next — across every track you're working on.

## How it's different

Most note apps give you a blank page and a thousand templates. Waypoint gives you three things and nothing else:

- **Tracks** — a subject you're working on (C++, Robotics, Interview Prep, a side project — whatever you're actually juggling).
- **Topics** — a unit inside a track (e.g. "Pointers", "ROS basics"), with a status: not started, in progress, or done.
- **Tasks** — the actual next actions inside a topic, each with an optional priority and due date.

Everything rolls up into one **Focus Now** list on the dashboard: the tasks that most need your attention, blended from what's overdue, what's due soon, and what you've manually flagged as high priority.

## Your data is yours

Waypoint doesn't have a database of its own. You connect it to a [Supabase](https://supabase.com) project you create and control — your notes live there, not on anyone else's server.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Connect a Supabase project

Waypoint needs somewhere to store your tracks, topics, and tasks:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in the contents of [`supabase/setup.sql`](./supabase/setup.sql), and run it. This creates every table the app needs (`tracks`, `topics`, `tasks`, `push_subscriptions`, `reminder_prefs`) and locks them down with row-level security so only you can read or write your own data.
3. Grab your **Project URL** and **anon key** from **Project Settings → API**.

The full walkthrough lives in [`docs/writebook/02-connecting-your-supabase-project.md`](./docs/writebook/02-connecting-your-supabase-project.md) — it's also served in-app at `/guide`.

### 3. Run the app

```bash
npm run dev
```

Open the app and paste in your Supabase project URL and anon key when prompted.

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
- [Supabase](https://supabase.com) (Postgres, auth, row-level security)
- [TanStack Query](https://tanstack.com/query) for data fetching
- [React Router](https://reactrouter.com)
- Installable as a PWA via [vite-plugin-pwa](https://vite-pwa-org.netlify.app)

## Project structure

```
src/
  components/   Shared UI (Logo, theme toggle, route guards)
  context/      React context providers (Supabase connection, theme)
  lib/          Supabase client + config helpers
  pages/        Route-level screens (Connect, Login, Dashboard, Guide)
supabase/
  setup.sql     One-time schema + RLS setup for your Supabase project
docs/
  writebook/    In-app guide content, served at /guide
```
