import { Capacitor, registerPlugin } from "@capacitor/core";

// Which build the app is: the website, the Play Store build (new versions
// come from Play), or the APK from the site (updates itself). The native
// half is android/.../AppDistributionPlugin.java; Android builds from
// before it existed are all the site APK.
export type Distribution = "web" | "play" | "sideload";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.yudhvirsingh.waypoint";

const AppDistribution = registerPlugin<{ get(): Promise<{ channel: string }> }>("AppDistribution");

let cached: Promise<Distribution> | null = null;

export function getDistribution(): Promise<Distribution> {
  cached ??= (async (): Promise<Distribution> => {
    if (!Capacitor.isNativePlatform()) return "web";
    if (!Capacitor.isPluginAvailable("AppDistribution")) return "sideload";
    try {
      const { channel } = await AppDistribution.get();
      return channel === "play" ? "play" : "sideload";
    } catch {
      return "sideload";
    }
  })();
  return cached;
}
