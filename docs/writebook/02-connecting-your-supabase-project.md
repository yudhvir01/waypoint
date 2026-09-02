---
title: Connecting Your Supabase Project
---
# Connecting Your Supabase Project

Waypoint needs somewhere to store your tracks, topics, and tasks. Instead of using a
shared server, you point it at your own free [Supabase](https://supabase.com)
project — a real Postgres database, under your account, that only your Waypoint app
talks to.

This takes about five minutes, once.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free, no card required
   for the free tier).
2. Click **New project**.
3. Give it a name (e.g. "waypoint-tracker"), set a database password (save it
   somewhere — you won't need it for the app, but it's good practice to keep it),
   and pick the region closest to you.
4. Wait for the project to finish provisioning — usually under two minutes.

## 2. Run the setup script

Waypoint ships with one SQL file, `supabase/setup.sql`, that creates every table it
needs and locks them down so only you can read or write your own data.

1. In your new Supabase project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/setup.sql` from the Waypoint repository, copy the whole file, and
   paste it into the query editor.
4. Click **Run**.

You should see a success message. If you ever want to double-check it worked, open
**Table Editor** — you should see `tracks`, `topics`, `tasks`, `push_subscriptions`,
and `reminder_prefs` listed.

## 3. Get your project URL and anon key

1. In Supabase, open **Project Settings → API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxx.supabase.co`).
3. Copy the **anon / public** key (a long string starting with `eyJ...`). This key
   is safe to use in a browser app — it only grants the access your row-level
   security policies allow, which is: you can only ever see your own rows.

Do **not** use the `service_role` key here — that key bypasses all security rules
and should never be pasted into a client app.

## 4. Connect Waypoint

1. Open Waypoint. On first run it'll show **Connect your Supabase project**.
2. Paste in the Project URL and anon key from step 3.
3. Click **Connect**. Waypoint checks that it can reach your project and that the
   setup script ran successfully before saving anything.
4. You'll land on the sign-up screen — create an account (this is your own
   account, inside your own Supabase project, separate from your Supabase login).

That's it. Your Project URL and anon key are saved only in your browser — Waypoint
never sends them anywhere else, and every device you use (phone, laptop) just
needs the same URL and key to see the same data.

## Using more than one device

To use Waypoint on your phone as well as your laptop, open Waypoint on the phone and go
through the same **Connect your Supabase project** step with the same URL and anon
key. Then log in with the same account. Both devices now read and write the same
Supabase project, so changes sync automatically.
