import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { decideUpdate, parseManifest, type UpdateDecision, type UpdateManifest } from "./appUpdate";
import { APP_VERSION, BUILD_TIME } from "./buildInfo";
import { UPDATE_BASE_URL } from "./env";

// Everything here is a no-op in a browser: the website updates itself
// through its service worker. Only the installed Android/iOS shell runs
// the bundle updater.

export type UpdateResult =
  | { kind: "unsupported" }
  | { kind: "up-to-date" }
  // A newer bundle is downloaded and will be in use from the next launch.
  | { kind: "bundle-ready"; version: string; bundleId: string }
  // A newer APK exists (or a newer bundle needs one).
  | {
      kind: "native";
      apkUrl: string;
      versionName: string;
      versionCode: number;
      sha256: string | null;
      required: boolean;
    }
  | { kind: "error"; message: string };

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Must be called once the app has actually started. If it isn't, the
// plugin assumes the new bundle is broken and goes back to the previous
// one on its own — which is the safety net for a bad release.
export async function markBundleReady(): Promise<void> {
  if (!isNative()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Nothing useful to do; the plugin's own timeout decides.
  }
}

export async function installedNativeBuild(): Promise<number> {
  try {
    const info = await App.getInfo();
    return Number(info.build) || 0;
  } catch {
    return 0;
  }
}

async function fetchManifest(): Promise<UpdateManifest> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${UPDATE_BASE_URL}/updates/latest.json?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Update check failed (${res.status}).`);
    const manifest = parseManifest(await res.json(), UPDATE_BASE_URL);
    if (!manifest) throw new Error("The update information wasn't valid.");
    return manifest;
  } finally {
    window.clearTimeout(timer);
  }
}

// Old downloaded bundles pile up on the phone otherwise.
async function pruneBundles(keepIds: string[]): Promise<void> {
  try {
    const { bundles } = await CapacitorUpdater.list();
    for (const b of bundles) {
      if (b.id !== "builtin" && !keepIds.includes(b.id)) {
        await CapacitorUpdater.delete({ id: b.id }).catch(() => undefined);
      }
    }
  } catch {
    // Housekeeping only.
  }
}

const STAGED_KEY = "waypoint.stagedBundle";
const PROBLEM_KEY = "waypoint.updateProblem";

interface Staged {
  id: string;
  builtAt: number;
  at: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Diagnostics only.
  }
}

// Run once at startup. A bundle that was staged and then isn't the one
// running means the plugin went back to the previous bundle (or never
// switched). Say so, instead of leaving "downloaded" with no visible effect.
export function reviewStagedUpdate(): void {
  const staged = readJson<Staged>(STAGED_KEY);
  if (!staged) return;
  if (BUILD_TIME >= staged.builtAt) {
    writeJson(STAGED_KEY, null);
    writeJson(PROBLEM_KEY, null);
    return;
  }
  // Give a freshly staged bundle the chance to be applied when the app is
  // next left, before calling it a failure.
  if (Date.now() - staged.at > 10 * 60 * 1000) {
    writeJson(PROBLEM_KEY, {
      message:
        "An update was downloaded but the app is still running the previous version. It either did not switch or went back after failing to start.",
      at: Date.now(),
    });
  }
}

export function lastUpdateProblem(): string | null {
  return readJson<{ message: string }>(PROBLEM_KEY)?.message ?? null;
}

async function downloadAndStage(manifest: UpdateManifest): Promise<{ version: string; bundleId: string }> {
  const version = String(manifest.builtAt);
  const { bundles } = await CapacitorUpdater.list();
  let bundle = bundles.find((b) => b.version === version && b.status !== "error");
  if (!bundle) {
    bundle = await CapacitorUpdater.download({
      url: manifest.bundle.url,
      version,
      checksum: manifest.bundle.checksum,
    });
  }
  // "next" = used from the next launch. It never reloads the screen under
  // someone who is in the middle of writing a note.
  await CapacitorUpdater.next({ id: bundle.id });
  writeJson(STAGED_KEY, { id: bundle.id, builtAt: manifest.builtAt, at: Date.now() } satisfies Staged);
  const current = await CapacitorUpdater.current();
  await pruneBundles([bundle.id, current.bundle.id]);
  return { version: manifest.version, bundleId: bundle.id };
}

// Switch to the downloaded bundle now. The plugin reloads the screen from
// the new files, so this does not return in the usual way.
export async function applyStagedUpdate(bundleId: string): Promise<void> {
  await CapacitorUpdater.set({ id: bundleId });
}

export interface UpdaterDiagnostics {
  runningBuildTime: number;
  runningVersion: string;
  currentBundleId: string;
  currentBundleVersion: string;
  nextBundleId: string | null;
  bundles: { id: string; version: string; status: string }[];
  nativeBuild: number;
  problem: string | null;
}

export async function getUpdaterDiagnostics(): Promise<UpdaterDiagnostics> {
  const [current, list, nativeBuild] = await Promise.all([
    CapacitorUpdater.current(),
    CapacitorUpdater.list().catch(() => ({ bundles: [] })),
    installedNativeBuild(),
  ]);
  let next: string | null = null;
  try {
    next = (await CapacitorUpdater.getNextBundle())?.id ?? null;
  } catch {
    // Older plugin builds don't expose it.
  }
  return {
    runningBuildTime: BUILD_TIME,
    runningVersion: APP_VERSION,
    currentBundleId: current.bundle.id,
    currentBundleVersion: current.bundle.version,
    nextBundleId: next && next !== "builtin" ? next : null,
    bundles: list.bundles.map((b) => ({ id: b.id, version: b.version, status: String(b.status) })),
    nativeBuild,
    problem: lastUpdateProblem(),
  };
}

export async function checkForUpdates(): Promise<UpdateResult> {
  if (!isNative()) return { kind: "unsupported" };
  try {
    const manifest = await fetchManifest();
    const nativeBuild = await installedNativeBuild();
    const decision: UpdateDecision = decideUpdate(manifest, { nativeBuild, buildTime: BUILD_TIME });

    if (decision.bundle) {
      const staged = await downloadAndStage(decision.bundle);
      return { kind: "bundle-ready", version: staged.version, bundleId: staged.bundleId };
    }
    if (decision.native) {
      return {
        kind: "native",
        apkUrl: decision.native.url,
        versionName: decision.native.versionName,
        versionCode: decision.native.versionCode,
        sha256: decision.native.sha256,
        required: decision.bundleNeedsNative,
      };
    }
    return { kind: "up-to-date" };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Couldn't check for updates." };
  }
}

export { APP_VERSION, BUILD_TIME };
