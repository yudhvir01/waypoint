// Publishes an over-the-air update of the web code to installed apps.
//
//   npm run release:web                      # notes optional
//   npm run release:web -- --notes "Search is faster"
//
// Builds the native-flavoured bundle (no service worker), zips it, and
// writes public/updates/latest.json describing it. Deploy the site
// afterwards (git push) and installed apps fetch it in the background.
//
// What it does NOT do: build or sign an APK. A new APK is only needed
// for native changes; see docs/mobile.md.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";

const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "dist-ota");
const updatesDir = join(root, "public", "updates");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const config = JSON.parse(readFileSync(join(root, "ota.config.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const minNative = Number(arg("min-native") ?? config.minNativeVersion);
if (!Number.isInteger(minNative) || minNative < 0) throw new Error("minNativeVersion must be a whole number.");

const gradle = readFileSync(join(root, "android/app/build.gradle"), "utf8");
const gradleCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
if (config.apk && gradleCode && gradleCode !== config.apk.versionCode) {
  console.warn(
    `! ota.config.json says the published APK is versionCode ${config.apk.versionCode}, but android/app/build.gradle is at ${gradleCode}.\n` +
      `  That's fine if you haven't published the newer APK yet. Update ota.config.json when you do.`,
  );
}

// Normally "now". Pass the timestamp the APK was built with (see
// docs/mobile.md) so a freshly installed app does not re-download a bundle
// that is identical to the one it shipped with.
const builtAt = Number(arg("built-at")) || Date.now();
const env = { ...process.env, WAYPOINT_BUILD_TIME: String(builtAt), WAYPOINT_OUT_DIR: "dist-ota" };
rmSync(outDir, { recursive: true, force: true });
console.log(`Building bundle ${builtAt} (app ${pkg.version})…`);
execFileSync("npx", ["tsc", "-b"], { cwd: root, stdio: "inherit", env });
execFileSync("npx", ["vite", "build", "--mode", "capacitor", "--emptyOutDir"], { cwd: root, stdio: "inherit", env });

// The plugin wants index.html at the top of the zip.
const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files[relative(outDir, full).split(sep).join("/")] = new Uint8Array(readFileSync(full));
  }
})(outDir);
if (!files["index.html"]) throw new Error("The build has no index.html at its root.");

const zip = zipSync(files, { level: 9 });
mkdirSync(updatesDir, { recursive: true });
// Only the newest bundle is kept; an older one has nothing to offer.
for (const name of readdirSync(updatesDir)) {
  if (/^waypoint-\d+\.zip$/.test(name)) rmSync(join(updatesDir, name));
}
const zipName = `waypoint-${builtAt}.zip`;
writeFileSync(join(updatesDir, zipName), zip);
const checksum = createHash("sha256").update(zip).digest("hex");

// The app verifies the APK it downloads against this, so it must be the
// hash of the file the site really serves.
let apk = config.apk ?? null;
const apkPath = join(root, "public", "downloads", "waypoint.apk");
if (apk) {
  try {
    const file = readFileSync(apkPath);
    apk = { ...apk, sha256: createHash("sha256").update(file).digest("hex") };
  } catch {
    console.warn("! public/downloads/waypoint.apk is missing, so the manifest has no APK checksum.");
  }
}

const manifest = {
  schema: 1,
  builtAt,
  version: pkg.version,
  bundle: { url: `/updates/${zipName}`, checksum },
  minNativeVersion: minNative,
  apk,
  notes: arg("notes") ?? null,
};
writeFileSync(join(updatesDir, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
rmSync(outDir, { recursive: true, force: true });

console.log(
  `\nWrote public/updates/${zipName} (${(zip.length / 1024).toFixed(0)} KiB) and latest.json\n` +
    `  needs app build >= ${minNative}\n\n` +
    `Next: commit public/updates and deploy the site. Installed apps pick it up in the background.`,
);
