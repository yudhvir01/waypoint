# Waypoint mobile development

Waypoint uses Capacitor 8 to package the existing React/Vite application as
native Android and iOS apps. The native application ID is
`com.yudhvirsingh.waypoint`.

## Build and sync

```bash
npm run cap:sync
```

This type-checks the app, creates a native-specific Vite build without the PWA
service worker, and copies it (plus native plugin configuration) into both
platform projects.

Useful commands:

```bash
npm run cap:android
npm run cap:ios
npm run cap:run:android
npm run cap:run:ios
```

The `cap:android` and `cap:ios` commands open the native projects in Android
Studio and Xcode. The `cap:run:*` commands build and launch a selected connected
device or simulator from the terminal.

Capacitor 8 requires Node.js 22 or newer. Android development also requires
Android Studio 2025.2.1 or newer and an Android SDK. iOS development requires
macOS with Xcode 26 or newer.

## Google sign-in on mobile

Google OAuth must open outside the embedded WebView. On native platforms,
Waypoint therefore opens the authorization request through Capacitor Browser
and listens for the callback through Capacitor App.

Before Google sign-in can be tested on a device:

1. Choose the production HTTPS callback, such as
   `https://your-domain.example/auth/google/callback`.
2. Set that exact value as `VITE_GOOGLE_REDIRECT_URI` for native builds.
3. Register the exact URI on the Google OAuth client.
4. Associate its host with Android through a verified Android App Link and
   with iOS through a Universal Link (`apple-app-site-association` plus the
   app's Associated Domains entitlement).

The callback must stay HTTPS. Do not run Google OAuth inside the WebView or use
an unverified custom URL scheme as the production redirect.

## Development workflow

After changing React/TypeScript code, run `npm run cap:sync` before rebuilding
the native app. Native projects under `android/` and `ios/` are source files;
commit deliberate changes to them just like web code.

For quick browser-only iteration, keep using `npm run dev`. A live-reload
WebView configuration can be added for local device testing later, but it must
never be committed as the production `server.url` because a release build must
load its bundled files from `dist/`.

## Updating installed apps

An installed Android app contains its own copy of the web code, so a site
deploy alone doesn't reach it. Two layers update separately.

| Layer | What it is | How it updates |
| --- | --- | --- |
| **Bundle** | The web code: every screen and feature | Quietly, in the background, over the air |
| **APK** | The native shell: plugins, permissions, icon | The user confirms the install (Android requires it for sideloaded apps) |

Almost every change is a bundle change.

### How the quiet update works

`src/lib/otaUpdater.ts` and `src/components/AppUpdater.tsx` (native builds
only):

1. On launch, when the app comes back to the foreground, and when the network
   returns, the app fetches `/updates/latest.json` from the site (at most once
   every 30 minutes).
2. If the manifest describes a bundle built after the running one, and the
   installed shell is new enough (`minNativeVersion`), it downloads the zip,
   verifies its SHA-256, and stages it. It is used from the **next launch**, so
   the screen is never swapped under someone mid-note.
3. After a new bundle starts, the app tells the plugin it is healthy. If it
   never does (a broken release), the plugin returns to the previous bundle by
   itself.
4. Guest-mode data is untouched: it's the same installed app with the same
   storage.

The updater is `@capgo/capacitor-updater` in manual mode. Its default cloud
endpoints (updates, channels and usage statistics) are blanked in
`capacitor.config.ts`, so nothing is sent to its vendor. Everything is fetched
from your own site, and the manifest may only point at that same HTTPS origin.

`VITE_UPDATE_BASE_URL` sets the site the app asks (default
`https://waypoint.yudhvir.in`).

### Publishing a web update

```bash
npm run release:web -- --notes "What changed"   # --notes is optional
git add public/updates && git commit -m "Release web update"
git push                                        # deploys the site
```

That builds the native bundle, zips it into `public/updates/`, and writes
`latest.json`. Only the newest zip is kept. Installed apps pick it up the next
time they check.

### Publishing a new APK

Needed only for native changes (a new Capacitor plugin, a permission, a
Capacitor upgrade). On a machine with Android Studio:

1. Raise `versionCode` (and `versionName`) in `android/app/build.gradle`.
2. `npm run cap:sync`, then build a **signed release APK**.
3. Sign it with **the same key as the APK already in people's hands**. Android
   only updates in place when the signature matches; with a different key the
   only route is uninstalling first, which erases guest-mode data. The key's
   SHA-256 fingerprint is the one in `public/.well-known/assetlinks.json`.
4. Put it at `public/downloads/waypoint.apk`.
5. Update `ota.config.json`: set `apk.versionCode` / `apk.versionName`, and
   raise `minNativeVersion` if the web bundle now needs the new shell.
6. `npm run release:web`, commit, push.

Apps on an older shell then show a notice with an **Update** button that opens
the APK download. If a new bundle requires a newer shell than the one
installed, the app keeps the old bundle and shows that notice instead.

Settings → About shows the installed version and has **Check for updates**.

### Limits

- A person on a build from before the updater existed (versionCode 1) won't
  update by itself. They install the new APK once; from then on it's automatic.
- iOS runs the website as an installed PWA, which updates through its service
  worker. The native iOS project is not distributed.
