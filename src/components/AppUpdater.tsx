import { useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { apkUpdater, useApkUpdate } from "../lib/apkUpdater";
import { isNative, markBundleReady } from "../lib/otaUpdater";
import { rememberDismissed, runUpdateCheck } from "../lib/updateFlow";

// Don't ask the server more often than this, however often the app is
// switched to or the network flickers.
const MIN_INTERVAL_MS = 30 * 60 * 1000;
// Let the app finish starting before using the network for this.
const STARTUP_DELAY_MS = 4000;

function percent(received: number, total: number): number | null {
  return total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// Runs only inside the installed app.
//
// Web bundle updates are fully quiet: downloaded in the background and used
// from the next launch. A new APK can't be quiet (Android makes a person
// confirm installing it), so the app downloads it with a progress bar and
// then opens Android's own install screen, which is that confirmation.
export function AppUpdater() {
  const update = useApkUpdate();
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!isNative()) return;
    let active = true;

    // This bundle started fine, so keep it. (If this never runs, the
    // plugin rolls back to the previous bundle by itself.)
    void markBundleReady();

    async function run() {
      const now = Date.now();
      if (now - lastCheck.current < MIN_INTERVAL_MS) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      lastCheck.current = now;
      await runUpdateCheck({ manual: false });
    }

    const startup = window.setTimeout(() => void (active && run()), STARTUP_DELAY_MS);
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);

    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener("appStateChange", (state) => {
      if (!state.isActive) return;
      // Back from "allow installs" or from Android's installer.
      void apkUpdater.resumeAfterSettings();
      apkUpdater.returnedFromInstaller();
      void run();
    }).then((listener) => {
      if (active) removeListener = () => listener.remove();
      else void listener.remove();
    });

    return () => {
      active = false;
      window.clearTimeout(startup);
      window.removeEventListener("online", onOnline);
      void removeListener?.();
    };
  }, []);

  const { phase, offer, received, total, error } = update;
  if (!offer || phase === "idle") return null;

  const pct = percent(received, total);
  const button = "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition";
  const primary = `${button} bg-primary text-primary-foreground hover:opacity-90`;
  const quiet =
    "shrink-0 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  function notNow() {
    if (offer) rememberDismissed(offer.versionCode);
    void apkUpdater.cancel().then(() => apkUpdater.dismiss());
  }

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card px-4 py-3 shadow-xl">
        {phase === "downloading" && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Downloading Waypoint {offer.versionName}</p>
              <button type="button" onClick={() => void apkUpdater.cancel()} className={quiet}>
                Cancel
              </button>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct ?? undefined}
            >
              <div
                className={`h-full rounded-full bg-primary transition-[width] duration-150 ${
                  pct === null ? "w-1/3 animate-pulse" : ""
                }`}
                style={pct === null ? undefined : { width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
              {pct === null ? "Starting…" : `${pct}% · ${megabytes(received)} of ${megabytes(total)} MB`}
            </p>
          </>
        )}

        {phase === "needs-permission" && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">One-time permission needed</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Allow Waypoint to install its own updates, then come back.
              </p>
            </div>
            <button type="button" onClick={() => void apkUpdater.openSettings()} className={primary}>
              Open settings
            </button>
          </div>
        )}

        {(phase === "ready" || phase === "installing") && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {phase === "installing" ? "Waiting for Android…" : `Waypoint ${offer.versionName} is ready`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tap Install on the screen Android shows. Your data stays.
              </p>
            </div>
            {phase === "ready" && (
              <button type="button" onClick={() => void apkUpdater.install()} className={primary}>
                Install
              </button>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">The update didn't finish</p>
              <p className="mt-0.5 break-words text-xs text-destructive">{error}</p>
            </div>
            <button type="button" onClick={() => void apkUpdater.start()} className={primary}>
              Try again
            </button>
            {!offer.required && (
              <button type="button" onClick={notNow} className={quiet}>
                Not now
              </button>
            )}
          </div>
        )}

        {phase === "offered" && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">A new version of Waypoint is available</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Version {offer.versionName}
                {offer.required && " — needed for the latest features"}
              </p>
            </div>
            {!offer.required && (
              <button type="button" onClick={notNow} className={quiet}>
                Not now
              </button>
            )}
            <button type="button" onClick={() => void apkUpdater.start()} className={primary}>
              Update
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
