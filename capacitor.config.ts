import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yudhvirsingh.waypoint",
  appName: "Waypoint",
  webDir: "dist",
  backgroundColor: "#f8fafc",
  server: {
    // Keep the local WebView on a secure origin. Browser APIs such as
    // crypto.randomUUID and IndexedDB then behave the same as they do on
    // Waypoint's HTTPS web deployment.
    androidScheme: "https",
  },
};

export default config;
