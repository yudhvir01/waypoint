import { AppShell } from "../components/AppShell";
import { useSupabase } from "../context/SupabaseProvider";
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

export function Settings() {
  const { config } = useSupabase();
  const { data: prefs, isLoading } = useReminderPrefs();
  const updatePrefs = useUpdateReminderPrefs();
  const push = usePushSubscription();

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Settings</h1>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 max-w-md">
          <Section title="Notifications">
            <Row
              label="Email reminders"
              description="Once a day, when something's overdue or due soon."
              control={
                <input
                  type="checkbox"
                  checked={prefs?.email_reminders_enabled ?? true}
                  onChange={(e) =>
                    updatePrefs.mutate({ email_reminders_enabled: e.target.checked })
                  }
                  className="h-4 w-4"
                />
              }
            />
            <Row
              label="Push notifications"
              control={
                <input
                  type="checkbox"
                  checked={prefs?.push_reminders_enabled ?? true}
                  onChange={(e) =>
                    updatePrefs.mutate({ push_reminders_enabled: e.target.checked })
                  }
                  className="h-4 w-4"
                />
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
                    onClick={() =>
                      push.subscribed ? push.disable.mutate() : push.enable.mutate()
                    }
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
                {push.enable.error instanceof Error
                  ? push.enable.error.message
                  : "Couldn't enable notifications."}
              </p>
            )}
          </Section>

          <Section title="Database">
            <Row
              label="Supabase project"
              description={config?.url.replace("https://", "").replace(".supabase.co", "")}
              control={
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Connected
                </span>
              }
            />
          </Section>
        </div>
      )}
    </AppShell>
  );
}
