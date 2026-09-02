import { Link } from "react-router-dom";
import { useReminderPrefs, useUpdateReminderPrefs } from "../hooks/useReminderPrefs";
import { usePushSubscription } from "../hooks/usePushSubscription";

export function Settings() {
  const { data: prefs, isLoading } = useReminderPrefs();
  const updatePrefs = useUpdateReminderPrefs();
  const push = usePushSubscription();

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Reminders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Get nudged about overdue and due-soon tasks by email and/or browser
        notification.
      </p>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <div>
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Email reminders</span>
              <input
                type="checkbox"
                checked={prefs?.email_reminders_enabled ?? true}
                onChange={(e) =>
                  updatePrefs.mutate({ email_reminders_enabled: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Sent to your account email once a day when something's overdue or
              due soon.
            </p>
          </div>

          <div>
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Browser push notifications</span>
              <input
                type="checkbox"
                checked={prefs?.push_reminders_enabled ?? true}
                onChange={(e) =>
                  updatePrefs.mutate({ push_reminders_enabled: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Requires enabling notifications on this device below.
            </p>
          </div>

          <div className="rounded-md border border-border px-3 py-3">
            {!push.supported && (
              <p className="text-sm text-muted-foreground">
                This browser doesn't support push notifications.
              </p>
            )}
            {push.supported && push.checking && (
              <p className="text-sm text-muted-foreground">Checking…</p>
            )}
            {push.supported && !push.checking && (
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {push.subscribed
                    ? "Notifications enabled on this device"
                    : "Notifications not enabled on this device"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    push.subscribed ? push.disable.mutate() : push.enable.mutate()
                  }
                  disabled={push.enable.isPending || push.disable.isPending}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:border-primary disabled:opacity-60"
                >
                  {push.subscribed ? "Disable" : "Enable"}
                </button>
              </div>
            )}
            {push.enable.isError && (
              <p className="mt-2 text-xs text-destructive">
                {push.enable.error instanceof Error
                  ? push.enable.error.message
                  : "Couldn't enable notifications."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
