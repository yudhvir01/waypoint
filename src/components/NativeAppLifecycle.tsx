import { useEffect } from "react";
import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

const GOOGLE_CALLBACK_PATH = "/auth/google/callback";
let lastHandledUrl: string | null = null;

function appRouteFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.pathname !== GOOGLE_CALLBACK_PATH) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Bridges native lifecycle URLs into React Router. In production, the
 * configured HTTPS OAuth callback should be associated with both native
 * apps as an iOS Universal Link / Android App Link. The operating system
 * then returns Google's system-browser redirect to the running WebView.
 */
export function NativeAppLifecycle() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;

    async function handleUrl(rawUrl: string) {
      const route = appRouteFromUrl(rawUrl);
      if (!active || !route || rawUrl === lastHandledUrl) return;
      lastHandledUrl = rawUrl;

      // Browser.close is implemented on iOS. Android's Custom Tab closes
      // itself when the App Link brings Waypoint back to the foreground.
      await Browser.close().catch(() => undefined);
      navigate(route, { replace: true });
    }

    let removeListener: (() => Promise<void>) | undefined;

    void CapacitorApp.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      void handleUrl(event.url);
    }).then((listener) => {
      if (active) {
        removeListener = () => listener.remove();
      } else {
        void listener.remove();
      }
    });

    // appUrlOpen covers a running app; getLaunchUrl covers a cold start.
    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (launch?.url) void handleUrl(launch.url);
    });

    return () => {
      active = false;
      void removeListener?.();
    };
  }, [navigate]);

  return null;
}
