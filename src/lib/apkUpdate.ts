// The in-app APK update, as a small state machine.
//
//   offered -> downloading -> (needs-permission) -> ready -> installing
//
// Android never installs silently, so the last step is always the system's
// own confirm screen. Everything before it (downloading with progress,
// checking the file, opening the installer) happens inside the app.
//
// The plugin is injected so every branch can be tested without a phone.

export interface ApkOffer {
  apkUrl: string;
  versionName: string;
  versionCode: number;
  sha256: string | null;
  // A newer web bundle that this app cannot run is waiting on it.
  required: boolean;
}

export type ApkPhase =
  | "idle"
  | "offered"
  | "downloading"
  | "needs-permission"
  | "ready"
  | "installing"
  | "error";

export interface ApkState {
  phase: ApkPhase;
  offer: ApkOffer | null;
  received: number;
  total: number;
  error: string | null;
}

export interface ApkInstallerDeps {
  available(): boolean;
  canInstall(): Promise<boolean>;
  openInstallSettings(): Promise<void>;
  download(url: string, sha256: string): Promise<{ path: string; versionCode: number; installedVersionCode: number }>;
  install(path: string): Promise<void>;
  cancel(): Promise<void>;
  onProgress(listener: (received: number, total: number) => void): Promise<() => void>;
  // Used when the in-app path isn't possible (an older app build, or a
  // manifest without a checksum): open the file in the browser.
  openInBrowser(url: string): Promise<void>;
}

const INITIAL: ApkState = { phase: "idle", offer: null, received: 0, total: 0, error: null };

export function createApkUpdater(deps: ApkInstallerDeps) {
  let state: ApkState = INITIAL;
  let path: string | null = null;
  let token = 0;
  const listeners = new Set<() => void>();

  function set(patch: Partial<ApkState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  }

  function inAppPossible(offer: ApkOffer): offer is ApkOffer & { sha256: string } {
    return deps.available() && !!offer.sha256;
  }

  async function launchInstaller() {
    if (!path) return;
    try {
      if (!(await deps.canInstall())) {
        set({ phase: "needs-permission" });
        return;
      }
      set({ phase: "installing" });
      await deps.install(path);
    } catch (e) {
      set({ phase: "error", error: e instanceof Error ? e.message : "Couldn't open the installer." });
    }
  }

  async function startDownload() {
    const offer = state.offer;
    if (!offer) return;
    if (!inAppPossible(offer)) {
      // No in-app route: the browser download is the best there is.
      await deps.openInBrowser(offer.apkUrl);
      return;
    }
    const mine = ++token;
    path = null;
    set({ phase: "downloading", received: 0, total: 0, error: null });
    let stop: (() => void) | null = null;
    try {
      stop = await deps.onProgress((received, total) => {
        if (mine === token) set({ received, total });
      });
      const file = await deps.download(offer.apkUrl, offer.sha256);
      if (mine !== token) return;
      if (file.versionCode <= file.installedVersionCode) {
        // Already up to date; nothing to install.
        set({ phase: "idle", offer: null });
        return;
      }
      path = file.path;
      set({ phase: "ready" });
      await launchInstaller();
    } catch (e) {
      if (mine !== token) return;
      const message = e instanceof Error ? e.message : String(e);
      if (message === "cancelled") set({ phase: "offered", error: null });
      else set({ phase: "error", error: message });
    } finally {
      stop?.();
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // A newer APK was found. With the in-app route available it starts
    // downloading on its own.
    async offer(next: ApkOffer, options: { autoStart: boolean }) {
      const busy = state.phase === "downloading" || state.phase === "installing" || state.phase === "ready";
      if (busy && state.offer?.versionCode === next.versionCode) return;
      set({ offer: next, phase: "offered", received: 0, total: 0, error: null });
      if (options.autoStart && inAppPossible(next)) await startDownload();
    },

    start: startDownload,

    async install() {
      if (path) await launchInstaller();
      else await startDownload();
    },

    // After the person came back from the "allow installs" screen.
    async resumeAfterSettings() {
      if (state.phase === "needs-permission") await launchInstaller();
    },

    // They came back from the system installer without installing.
    returnedFromInstaller() {
      if (state.phase === "installing") set({ phase: "ready" });
    },

    async openSettings() {
      await deps.openInstallSettings();
    },

    async cancel() {
      token++;
      try {
        await deps.cancel();
      } catch {
        // Nothing running.
      }
      set({ phase: "offered", received: 0, total: 0, error: null });
    },

    dismiss() {
      token++;
      path = null;
      set({ ...INITIAL });
    },
  };
}

export type ApkUpdater = ReturnType<typeof createApkUpdater>;
