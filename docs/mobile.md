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
