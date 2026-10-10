import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

// Chrome and other Chromium browsers hand the page an event it can hold
// and fire later, from a button, to show the browser's own install
// dialog. It isn't in the standard DOM typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export interface InstallPrompt {
  // False inside the installed app (native or already added to the home
  // screen), where offering to install makes no sense.
  available: boolean;
  // The browser will show its install dialog when install() is called.
  canPrompt: boolean;
  installed: boolean;
  install: () => Promise<void>;
}

export function useInstallPrompt(): InstallPrompt {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [available] = useState(() => !Capacitor.isNativePlatform() && !isStandalone());

  useEffect(() => {
    function onPrompt(e: Event) {
      // Keeps the browser's own mini-bar away; the page offers a button.
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setInstalled(true);
    // A prompt event can only be used once.
    setEvent(null);
  }, [event]);

  return { available, canPrompt: event !== null, installed, install };
}
