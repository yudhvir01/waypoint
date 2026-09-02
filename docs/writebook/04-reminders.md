---
title: Setting Up Reminders
---
# Setting Up Reminders

Waypoint can nudge you about overdue and due-soon tasks by email and/or a
browser push notification. Unlike the rest of the app, this piece needs a
small amount of one-time setup outside the app itself, because sending
notifications on a schedule requires something running server-side — there's
no server in Waypoint by default, so this uses a Supabase Edge Function.

If you'd rather skip this for now, the rest of the app works fine without
it — reminders are entirely optional.

## What you're setting up

- **`supabase/functions/send-reminders`** — an Edge Function that checks
  everyone's overdue/due-soon tasks once a day and sends emails and/or
  pushes.
- **A [Resend](https://resend.com) account** — for sending the emails.
- **A VAPID keypair** — for browser push. Already generated for you (see
  below); you don't need to create your own.
- **A daily schedule** — `supabase/reminders-cron.sql` sets this up via
  `pg_cron`.

## 1. Deploy the Edge Function

You'll need the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed and logged in.

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy send-reminders
```

## 2. Set secrets

In the Supabase dashboard, go to **Edge Functions → send-reminders →
Secrets** (or use `supabase secrets set` from the CLI) and set:

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | From your [Resend](https://resend.com) dashboard → API Keys |
| `REMINDER_FROM_EMAIL` | A verified sending address, or `onboarding@resend.dev` for testing (only delivers to the email on your Resend account while testing) |
| `VAPID_PUBLIC_KEY` | `BG56TxRyNZ734xjlmieY4lQxzW5q5eWgrv3K1V2vhSps1-2eS_LTDHNK6vDlRUk2b2GvsWqAyLTr-zN1-Xt6Whk` |
| `VAPID_PRIVATE_KEY` | Kept private — ask whoever set up your project for this, or generate a fresh pair with `npx web-push generate-vapid-keys` and update both this secret and `VAPID_PUBLIC_KEY` in `src/lib/push.ts` to match |
| `VAPID_SUBJECT` | `mailto:you@example.com` — a contact address push providers may use if something's wrong |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically —
you don't set those.

## 3. Schedule it

Open `supabase/reminders-cron.sql`, fill in your project ref and
`service_role` key (Project Settings → API Keys), and run it in the SQL
Editor. It schedules the function to run daily at 08:00 UTC — edit the
cron expression in the file if you want a different time.

Prefer a UI? Project → **Integrations → Cron Jobs** in the dashboard lets you
schedule the same Edge Function invocation without writing SQL.

## 4. Turn it on in the app

Open Waypoint → **Reminders** (top right of the dashboard). Toggle email
and/or push on, and click **Enable** under browser notifications to
subscribe this device.

## How it decides what to send

Once a day, the function looks at every task that isn't done and has a due
date. A task counts as:

- **Overdue** — due date is in the past.
- **Due soon** — due today or tomorrow.

Everyone with at least one overdue or due-soon task gets one email (if
enabled) listing all of them, and a push notification (if enabled and
subscribed) with the count. There's no dedup log yet, so if you trigger the
function manually more than once in a day, you'll get duplicate reminders —
stick to the daily schedule for normal use.
