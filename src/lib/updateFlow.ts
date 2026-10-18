import { apkUpdater } from "./apkUpdater";
import { PLAY_STORE_URL, getDistribution } from "./distribution";
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
  if (result.kind === "native" && (await getDistribution()) === "play") {
    // The Play build gets new versions from Play, and the APK in the
    // manifest is the site's, signed differently. Only when this bundle
    // can't run without a newer app is there anything to say: send them
    // to the store listing.
    if (!result.required) return { kind: "up-to-date" };
    await apkUpdater.offer(
      { apkUrl: PLAY_STORE_URL, versionName: result.versionName, versionCode: result.versionCode, sha256: null, required: true },
      { autoStart: false },
    );
    return { ...result, apkUrl: PLAY_STORE_URL, sha256: null };
  }
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
