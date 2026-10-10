import { apkUpdater } from "./apkUpdater";
import { checkForUpdates, type UpdateResult } from "./otaUpdater";

const DISMISSED_KEY = "waypoint.dismissedApk";

export function dismissedApkCode(): number {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function rememberDismissed(versionCode: number): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    // It will simply be offered again next time.
  }
}

// One check, used by the automatic launch/resume check and by the
// "Check for updates" button. A newer APK goes to the in-app updater,
// which downloads it with progress and hands it to Android's installer.
export async function runUpdateCheck(options: { manual: boolean }): Promise<UpdateResult> {
  const result = await checkForUpdates();
  if (result.kind === "native") {
    const dismissed = !result.required && result.versionCode <= dismissedApkCode();
    // Someone who pressed the button wants it; someone who said "not now"
    // to this exact version is left alone until a newer one exists.
    if (options.manual || !dismissed) {
      await apkUpdater.offer(
        {
          apkUrl: result.apkUrl,
          versionName: result.versionName,
          versionCode: result.versionCode,
          sha256: result.sha256,
          required: result.required,
        },
        { autoStart: true },
      );
    }
  }
  return result;
}
