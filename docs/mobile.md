# Waypoint mobile development

Waypoint uses Capacitor 8 to package the existing React/Vite application as
native Android and iOS apps. The native application ID is
`com.yudhvirsingh.waypoint`.

## Configuration baked into native builds

A native build (and every over-the-air bundle) is compiled on your machine,
not on Vercel, so it does not see the website's environment variables. Without
them the app has no default Supabase project and shows **Google sign-in as
"coming soon"**, because that option only appears when its client ID and token
relay URL are present at build time.

Put the same public values the website uses in `.env.capacitor.local` (it is
git-ignored; Vite reads it for native builds and for `release:web`):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the project's anon key>
VITE_GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
VITE_GOOGLE_TOKEN_RELAY_URL=https://<project-ref>.supabase.co/functions/v1/google-token
VITE_GOOGLE_REDIRECT_URI=https://waypoint.yudhvir.in/auth/google/callback
VITE_UPDATE_BASE_URL=https://waypoint.yudhvir.in
```

All of these are public by design (see `.env.example`). To check a build has
them, search its JavaScript for `googleusercontent.com`.

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
   verifies its SHA-256, and stages it with the plugin's `next()`. The plugin
   switches to a staged bundle when the app is **sent to the background**, then
   reloads, so the screen is never swapped under someone mid-note. Settings →
   About has **Restart now**, which calls `set()` to switch immediately and
   surfaces any error, and **Update details**, which shows the running bundle,
   the staged one and what is on disk. If a bundle was staged but the app is
   still on the old build ten minutes later, the details say so
   (`reviewStagedUpdate` in `src/lib/otaUpdater.ts`).
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

### Installing a new APK from inside the app

A new APK is downloaded and installed from the app itself, so nobody has to
find a file in Downloads. `src/lib/apkUpdate.ts` is the flow (a small state
machine, tested against a fake installer), `src/components/AppUpdater.tsx` is
the notice with its progress bar, and
`android/app/src/main/java/com/yudhvirsingh/waypoint/ApkInstallerPlugin.java`
is the native half.

1. A check finds a newer APK in `latest.json` and the download **starts on its
   own**, with a progress bar and a Cancel button. "Not now" remembers that
   version and stops asking.
2. The plugin streams the file into the app's cache while hashing it. A SHA-256
   that doesn't match `apk.sha256` in the manifest deletes the file.
3. It checks the file is the same package and has a higher `versionCode` than
   what is installed.
4. If "Install unknown apps" isn't allowed for Waypoint yet, the notice shows
   **Open settings**. Coming back continues by itself.
5. The file is handed to Android's installer through the app's `FileProvider`.
   Android's own "update this app?" screen is the confirmation. It cannot be
   skipped for a sideloaded app, and it only accepts the APK if it is signed
   with the same key as the installed one.

If the plugin isn't present (an app from before it existed) or the manifest has
no checksum, the notice falls back to opening the download in the browser.

The manifest's `apk.sha256` is computed by `release:web` from
`public/downloads/waypoint.apk`, so **sign and place the APK before running it**.
The app declares `REQUEST_INSTALL_PACKAGES` for this.

### Focus timer notifications

When a focus block or break ends while the app is in the background, a system
notification tells the person (`src/lib/timerNotifications.ts`, using
`@capacitor/local-notifications`). It is scheduled with Android's alarm manager
whenever a block or break is running, so it fires even if the app is closed.
There are two channels, because Android fixes a channel's sound when it is
created: `focus-timer` (sound and vibration) is used while the app is out of
sight, and `focus-timer-quiet` (no sound) while it is open, since the app plays
its own tones and shows the pop-up. A notification that has been delivered is
removed when the person answers the pop-up.

The app declares `POST_NOTIFICATIONS` (asked for the first time a timer is
started) and `USE_EXACT_ALARM`, which Android grants automatically to timer
apps so the notification fires on the minute. The status-bar icon is
`res/drawable/ic_stat_waypoint.xml`. A browser cannot schedule anything once its
tab is closed, so this is Android-only.

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
Capacitor upgrade). On a machine with the Android SDK and JDK 21:

1. Raise `versionCode` (and `versionName`) in `android/app/build.gradle`.
2. Build the unsigned release:

   ```bash
   npm run cap:sync
   cd android && ./gradlew assembleRelease && cd ..
   ```

3. Sign it and place it on the site:

   ```bash
   scripts/sign-apk.sh        # writes public/downloads/waypoint.apk
   ```

   It reads the key from `~/.config/waypoint/release-signing.env`
   (`release.keystore` next to it). **Neither file is in the repo, and both
   must be backed up.** Android only updates an installed app in place when
   the new APK has the same signing key. Lose the key and every installed app
   needs uninstalling first, which erases guest-mode data.
4. If the key is ever replaced, add the new SHA-256 fingerprint to
   `public/.well-known/assetlinks.json` (keep the old one listed) so Google
   sign-in keeps returning to the app.
5. Update `ota.config.json`: set `apk.versionCode` / `apk.versionName`, and
   raise `minNativeVersion` if the web bundle now needs the new shell.
6. Publish the matching bundle with the **same build timestamp** the APK was
   built with, so the freshly installed app doesn't re-download a bundle that is
   identical to the one it shipped with:

   ```bash
   T=$(date +%s%3N)
   WAYPOINT_BUILD_TIME=$T npm run cap:sync        # step 2, with the timestamp
   # ... assembleRelease, scripts/sign-apk.sh ...
   npm run release:web -- --built-at $T
   ```

   Then commit and push.

Native builds and update bundles leave out `public/downloads`,
`public/updates` and `public/.well-known`: those are things the site serves,
not things the app should carry.

Apps on an older shell then show a notice with an **Update** button that opens
the APK download. If a new bundle requires a newer shell than the one
installed, the app keeps the old bundle and shows that notice instead.

Settings → About shows the installed version and has **Check for updates**.

### Limits

- A person on a build from before the updater existed (versionCode 1) won't
  update by itself. They install the new APK once; from then on it's automatic.
- iOS runs the website as an installed PWA, which updates through its service
  worker. The native iOS project is not distributed.
