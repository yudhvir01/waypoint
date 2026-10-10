// Deciding whether an installed app is out of date. Pure, so every case
// (newer bundle, bundle that needs a newer shell, newer APK, junk
// manifest) can be tested without a device.
//
// Two layers update separately:
//   - the bundle: the web code (everything you see). Downloaded and
//     applied quietly in the background.
//   - the APK: the native shell. Android only lets a person confirm
//     installing it, so this layer can only be offered.

export interface UpdateManifest {
  schema: 1;
  // When the bundle was built (ms since epoch). Newer than the running
  // bundle's own BUILD_TIME means "update".
  builtAt: number;
  version: string;
  bundle: { url: string; checksum: string };
  // The lowest native build (Android versionCode) the bundle runs on.
  minNativeVersion: number;
  // The newest APK on offer, if any.
  apk: { versionCode: number; versionName: string; url: string } | null;
  notes: string | null;
}

const SHA256 = /^[0-9a-f]{64}$/i;

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// Resolves a possibly-relative URL against the site and insists on HTTPS
// and the site's own origin. A manifest is code the app will run, so it
// must not be able to point at anywhere else.
function sameOriginUrl(value: unknown, base: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const baseUrl = new URL(base);
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" || url.origin !== baseUrl.origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseManifest(raw: unknown, baseUrl: string): UpdateManifest | null {
  const o = obj(raw);
  if (!o || o.schema !== 1) return null;

  const builtAt = o.builtAt;
  if (typeof builtAt !== "number" || !Number.isFinite(builtAt) || builtAt <= 0) return null;

  const bundle = obj(o.bundle);
  const bundleUrl = bundle && sameOriginUrl(bundle.url, baseUrl);
  const checksum = bundle && typeof bundle.checksum === "string" ? bundle.checksum : null;
  if (!bundleUrl || !checksum || !SHA256.test(checksum)) return null;

  const minNative = o.minNativeVersion;
  if (typeof minNative !== "number" || !Number.isInteger(minNative) || minNative < 0) return null;

  let apk: UpdateManifest["apk"] = null;
  const rawApk = obj(o.apk);
  if (rawApk) {
    const url = sameOriginUrl(rawApk.url, baseUrl);
    const code = rawApk.versionCode;
    if (url && typeof code === "number" && Number.isInteger(code) && code > 0) {
      apk = {
        versionCode: code,
        versionName: typeof rawApk.versionName === "string" ? rawApk.versionName : String(code),
        url,
      };
    }
  }

  return {
    schema: 1,
    builtAt,
    version: typeof o.version === "string" ? o.version : String(builtAt),
    bundle: { url: bundleUrl, checksum: checksum.toLowerCase() },
    minNativeVersion: minNative,
    apk,
    notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null,
  };
}

export interface Installed {
  // Android versionCode of the installed shell.
  nativeBuild: number;
  // BUILD_TIME of the running web bundle.
  buildTime: number;
}

export interface UpdateDecision {
  // A newer bundle this shell can run: download and apply quietly.
  bundle: UpdateManifest | null;
  // A newer APK to offer, for the person to install.
  native: NonNullable<UpdateManifest["apk"]> | null;
  // A newer bundle exists but needs a shell this one isn't.
  bundleNeedsNative: boolean;
}

export function decideUpdate(manifest: UpdateManifest, installed: Installed): UpdateDecision {
  const bundleNewer = manifest.builtAt > installed.buildTime;
  const shellTooOld = manifest.minNativeVersion > installed.nativeBuild;
  const apkNewer = manifest.apk !== null && manifest.apk.versionCode > installed.nativeBuild;

  return {
    bundle: bundleNewer && !shellTooOld ? manifest : null,
    native: apkNewer ? manifest.apk : null,
    bundleNeedsNative: bundleNewer && shellTooOld,
  };
}
