import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yudhvirsingh.waypoint",
  appName: "Waypoint",
  webDir: "dist",
  backgroundColor: "#f8fafc",
  plugins: {
    CapacitorUpdater: {
      // Updates are checked and downloaded by the app itself (see
      // src/lib/otaUpdater.ts) against Waypoint's own site, never against
      // the plugin vendor's cloud. The three URLs are blanked so nothing
      // is sent to it, including usage and crash statistics.
      autoUpdate: false,
      statsUrl: "",
      updateUrl: "",
      channelUrl: "",
      // A downloaded bundle must call notifyAppReady within this time or
      // the app returns to the previous one.
      appReadyTimeout: 15000,
      resetWhenUpdate: true,
    },
  },
  server: {
    // Keep the local WebView on a secure origin. Browser APIs such as
    // crypto.randomUUID and IndexedDB then behave the same as they do on
    // Waypoint's HTTPS web deployment.
    androidScheme: "https",
  },
};

export default config;
