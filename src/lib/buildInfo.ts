// What this particular build of the web code is. The JS knows its own
// identity, whether it's running in a browser, bundled inside an APK, or
// downloaded later as an over-the-air update — which is what lets the
// updater tell "newer than me" without any bookkeeping.
export const APP_VERSION: string = __APP_VERSION__;
// Milliseconds since the epoch at which this bundle was built.
export const BUILD_TIME: number = __BUILD_TIME__;
