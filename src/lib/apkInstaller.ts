import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// The native half lives in android/.../ApkInstallerPlugin.java. It only
// exists in the Android app, and only from the build that added it, so
// callers must check isApkInstallerAvailable() and fall back.
export interface ApkInstallerPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  download(options: { url: string; sha256: string }): Promise<{
    path: string;
    size: number;
    versionCode: number;
    installedVersionCode: number;
  }>;
  install(options: { path: string }): Promise<void>;
  cancel(): Promise<void>;
  addListener(
    event: "progress",
    listener: (progress: { received: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export function isApkInstallerAvailable(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("ApkInstaller");
}
