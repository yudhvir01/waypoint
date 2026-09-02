// Supabase Edge Function: send-reminders
//
// Run on a schedule (see supabase/reminders-cron.sql) — once a day is
// recommended. For every user with an overdue or due-soon (today/tomorrow)
// task, sends an email (via Resend) and/or a browser push notification
// (via Web Push), depending on that user's reminder_prefs.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   RESEND_API_KEY        — Resend API key
//   REMINDER_FROM_EMAIL   — verified "from" address, e.g. reminders@yourdomain.com
//                            (or onboarding@resend.dev for testing — only
//                            delivers to your own Resend account email)
//   VAPID_PUBLIC_KEY       — same public key as src/lib/push.ts
//   VAPID_PRIVATE_KEY      — pair of the above, keep secret
//   VAPID_SUBJECT          — mailto:you@example.com (contact for push provider)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime — no need to set them yourself.

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";
import webpush from "npm:web-push@3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL") ?? "onboarding@resend.dev";

const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@example.com";
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

interface DueTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  topic: { title: string; track: { name: string } };
}

function classify(dueDate: string | null): "overdue" | "due-soon" | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const delta = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (delta < 0) return "overdue";
  if (delta <= 1) return "due-soon";
  return null;
}

Deno.serve(async () => {
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, topic:topics(title, track:tracks(name, user_id))")
    .eq("done", false)
    .not("due_date", "is", null);

  if (tasksError) {
    return new Response(JSON.stringify({ error: tasksError.message }), { status: 500 });
  }

  type RawTask = DueTask & { topic: { title: string; track: { name: string; user_id: string } } };
  const dueByUser = new Map<string, RawTask[]>();

  for (const task of (tasks ?? []) as unknown as RawTask[]) {
    if (!classify(task.due_date)) continue;
    const userId = task.topic.track.user_id;
    if (!dueByUser.has(userId)) dueByUser.set(userId, []);
    dueByUser.get(userId)!.push(task);
  }

  if (dueByUser.size === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  const { data: prefsRows } = await supabase
    .from("reminder_prefs")
    .select("*")
    .in("user_id", [...dueByUser.keys()]);
  const prefsByUser = new Map((prefsRows ?? []).map((p) => [p.user_id, p]));

  let emailsSent = 0;
  let pushesSent = 0;

  for (const [userId, userTasks] of dueByUser) {
    const prefs = prefsByUser.get(userId) ?? {
      email_reminders_enabled: true,
      push_reminders_enabled: true,
    };

    const lines = userTasks
      .map((t) => {
        const tag = classify(t.due_date) === "overdue" ? "Overdue" : "Due soon";
        return `- [${tag}] ${t.topic.track.name} / ${t.topic.title}: ${t.title}`;
      })
      .join("\n");

    if (prefs.email_reminders_enabled && resend) {
      const { data: userRow } = await supabase.auth.admin.getUserById(userId);
      const email = userRow?.user?.email;
      if (email) {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: `Waypoint: ${userTasks.length} task${userTasks.length === 1 ? "" : "s"} need${
            userTasks.length === 1 ? "s" : ""
          } attention`,
          text: `Tasks needing attention:\n\n${lines}`,
        });
        emailsSent++;
      }
    }

    if (prefs.push_reminders_enabled && vapidPublic && vapidPrivate) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: "Waypoint",
              body: `${userTasks.length} task${userTasks.length === 1 ? "" : "s"} need${
                userTasks.length === 1 ? "s" : ""
              } your attention`,
              url: "/",
            }),
          );
          pushesSent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ users: dueByUser.size, emailsSent, pushesSent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
