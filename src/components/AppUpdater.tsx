import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { checkForUpdates, isNative, markBundleReady, type UpdateResult } from "../lib/otaUpdater";

// Don't ask the server more often than this, however often the app is
// switched to or the network flickers.
const MIN_INTERVAL_MS = 30 * 60 * 1000;
// Let the app finish starting before using the network for this.
const STARTUP_DELAY_MS = 4000;
const DISMISSED_KEY = "waypoint.dismissedApk";

function dismissedCode(): number {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY)) || 0;
  } catch {
    return 0;
  }
}

type NativeOffer = Extract<UpdateResult, { kind: "native" }>;

// Runs only inside the installed app. Bundle updates are fully quiet —
// downloaded in the background and used from the next launch. The one
// thing that can't be quiet is a new APK, because Android makes a person
// confirm installing it; for that, a small notice is shown.
export function AppUpdater() {
  const [offer, setOffer] = useState<NativeOffer | null>(null);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!isNative()) return;
    let active = true;

    // This bundle started fine, so keep it. (If this never runs, the
    // plugin rolls back to the previous bundle by itself.)
    void markBundleReady();

    async function run(force = false) {
      const now = Date.now();
      if (!force && now - lastCheck.current < MIN_INTERVAL_MS) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      lastCheck.current = now;
      const result = await checkForUpdates();
      if (!active) return;
      if (result.kind === "native" && (result.required || result.versionCode > dismissedCode())) {
        setOffer(result);
      }
    }

    const startup = window.setTimeout(() => void run(), STARTUP_DELAY_MS);
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);

    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener("appStateChange", (state) => {
      if (state.isActive) void run();
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

  if (!offer) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      role="status"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">A new version of Waypoint is available</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version {offer.versionName}
            {offer.required && " — needed for the latest features"}
          </p>
        </div>
        {!offer.required && (
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(DISMISSED_KEY, String(offer.versionCode));
              } catch {
                // It will simply be offered again next time.
              }
              setOffer(null);
            }}
            className="shrink-0 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Later
          </button>
        )}
        <button
          type="button"
          onClick={() => void Browser.open({ url: offer.apkUrl })}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Update
        </button>
      </div>
    </div>
  );
}
