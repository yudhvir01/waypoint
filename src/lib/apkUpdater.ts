import { Browser } from "@capacitor/browser";
import { useSyncExternalStore } from "react";
import { ApkInstaller, isApkInstallerAvailable } from "./apkInstaller";
import { createApkUpdater, type ApkState } from "./apkUpdate";

// The app-wide updater, wired to the real plugin.
export const apkUpdater = createApkUpdater({
  available: isApkInstallerAvailable,
  canInstall: async () => (await ApkInstaller.canInstall()).allowed,
  openInstallSettings: () => ApkInstaller.openInstallSettings(),
  download: (url, sha256) => ApkInstaller.download({ url, sha256 }),
  install: (path) => ApkInstaller.install({ path }),
  cancel: () => ApkInstaller.cancel(),
  onProgress: async (listener) => {
    const handle = await ApkInstaller.addListener("progress", (p) => listener(p.received, p.total));
    return () => void handle.remove();
  },
  openInBrowser: (url) => Browser.open({ url }),
});

export function useApkUpdate(): ApkState {
  return useSyncExternalStore(apkUpdater.subscribe, apkUpdater.getState, apkUpdater.getState);
}
