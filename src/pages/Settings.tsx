import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ThemeToggle } from "../components/ThemeToggle";
import { Switch } from "../components/Switch";
import { GuestMigrationDialog } from "../components/GuestMigrationDialog";
import { useBackend } from "../context/BackendProvider";
import { useReminderPrefs, useUpdateReminderPrefs } from "../hooks/useReminderPrefs";
import { usePushSubscription } from "../hooks/usePushSubscription";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-6 first:pt-0 last:border-0">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function NotificationsSection() {
  const { data: prefs, isLoading } = useReminderPrefs();
  const updatePrefs = useUpdateReminderPrefs();
  const push = usePushSubscription();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Section title="Notifications">
      <Row
        label="Email reminders"
        description="Once a day, when something's overdue or due soon."
        control={
          <Switch
            label="Email reminders"
            checked={prefs?.email_reminders_enabled ?? true}
            onChange={(checked) => updatePrefs.mutate({ email_reminders_enabled: checked })}
          />
        }
      />
      <Row
        label="Push notifications"
        control={
          <Switch
            label="Push notifications"
            checked={prefs?.push_reminders_enabled ?? true}
            onChange={(checked) => updatePrefs.mutate({ push_reminders_enabled: checked })}
          />
        }
      />
      <Row
        label="Remind me before due"
        description="Applies to any task with a due date."
        control={
          <select
            value={prefs?.lead_time_days ?? 1}
            onChange={(e) => updatePrefs.mutate({ lead_time_days: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            <option value={0}>On the due date</option>
            <option value={1}>1 day before</option>
            <option value={2}>2 days before</option>
            <option value={3}>3 days before</option>
            <option value={7}>1 week before</option>
          </select>
        }
      />
      <Row
        label="This device"
        description={
          !push.supported
            ? "Not supported in this browser"
            : push.checking
              ? "Checking…"
              : push.subscribed
                ? "Enabled"
                : "Not enabled"
        }
        control={
          push.supported && (
            <button
              type="button"
              onClick={() => (push.subscribed ? push.disable.mutate() : push.enable.mutate())}
              disabled={push.checking || push.enable.isPending || push.disable.isPending}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary disabled:opacity-60"
            >
              {push.subscribed ? "Disable" : "Enable"}
            </button>
          )
        }
      />
      {push.enable.isError && (
        <p className="text-xs text-destructive">
          {push.enable.error instanceof Error ? push.enable.error.message : "Couldn't enable notifications."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Want a heads-up on one specific task regardless of its due date? Click the bell next to
        it on the track page.
      </p>
    </Section>
  );
}

function DatabaseSection({ onMigrate }: { onMigrate: () => void }) {
  const { mode, ownerLabel, supabaseConfig, isCustomSupabaseProject, disconnectSupabaseProject } = useBackend();

  if (mode === "guest") {
    return (
      <Section title="Database">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            You're using guest mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything you've added is stored only in this browser's local storage — not on any
            server, not synced anywhere. Clearing your browser data, switching browsers, or
            moving to another device loses it for good.
          </p>
        </div>
        <button
          type="button"
          onClick={onMigrate}
          className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Move to Supabase
        </button>
      </Section>
    );
  }

  if (mode === "drive") {
    return (
      <Section title="Database">
        <Row
          label="Google Drive"
          description="Stored as one file in a “Waypoint” folder in your Drive."
          control={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {ownerLabel}
            </span>
          }
        />
      </Section>
    );
  }

  return (
    <Section title="Database">
      <Row
        label="Supabase project"
        description={
          supabaseConfig
            ? `${supabaseConfig.url.replace("https://", "").replace(".supabase.co", "")}${
                isCustomSupabaseProject ? "" : " (default)"
              }`
            : undefined
        }
        control={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {ownerLabel}
          </span>
        }
      />
      <button
        type="button"
        onClick={disconnectSupabaseProject}
        className="self-start text-xs text-muted-foreground hover:underline"
      >
        Sign out and use a different Supabase project
      </button>
    </Section>
  );
}

export function Settings() {
  const { mode } = useBackend();
  const [migrating, setMigrating] = useState(false);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Settings</h1>

      <div className="mt-7 max-w-lg">
        <Section title="Appearance">
          <Row label="Theme" control={<ThemeToggle />} />
        </Section>

        {mode === "supabase" ? (
          <NotificationsSection />
        ) : (
          <Section title="Notifications">
            <p className="text-xs text-muted-foreground">
              Email and push reminders need a server watching your due dates while you're away —
              {mode === "drive" ? " Google Drive has none." : " guest mode has none."} Move to
              Supabase to turn these on.
            </p>
          </Section>
        )}

        <DatabaseSection onMigrate={() => setMigrating(true)} />
      </div>

      {migrating && <GuestMigrationDialog onClose={() => setMigrating(false)} />}
    </AppShell>
  );
}
