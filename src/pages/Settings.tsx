import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ThemeToggle } from "../components/ThemeToggle";
import { GuestMigrationDialog } from "../components/GuestMigrationDialog";
import { useBackend } from "../context/BackendProvider";
import {
  clearGoogleMigration,
  markGoogleMigration,
  startGoogleSignIn,
} from "../lib/backend/googleAuth";
import { GOOGLE_SIGNIN_ENABLED } from "../lib/env";
import { getFocusSettings, getSpacedRevisit, setFocusSettings, setSpacedRevisit } from "../lib/preferences";
import { backupFileName, downloadTextFile, snapshotToBackupJson } from "../lib/exportData";
import { MAX_OPEN_REVIEWS_PER_TRACK, REVIEW_OFFSETS_DAYS } from "../lib/taskActions";
import { parseBackup, type ParsedBackup } from "../lib/backup";
import { APP_VERSION, BUILD_TIME } from "../lib/buildInfo";
import {
  applyStagedUpdate,
  getUpdaterDiagnostics,
  installedNativeBuild,
  isNative,
  type UpdateResult,
  type UpdaterDiagnostics,
} from "../lib/otaUpdater";
import { runUpdateCheck } from "../lib/updateFlow";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-6 first:pt-0 last:border-0">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* min-w-0: without it, a long description can't wrap within its
          share of the row and forces the whole row wider than the
          screen instead. */}
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function DatabaseSection({
  onMigrate,
  onMigrateGoogle,
}: {
  onMigrate: () => void;
  onMigrateGoogle: () => void;
}) {
  const { mode, ownerLabel, supabaseConfig, isCustomSupabaseProject, disconnectSupabaseProject } = useBackend();

  if (mode === "guest") {
    return (
      <Section title="Database">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            You're using guest mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything you've added is stored only in this browser's local storage — not on any
            server, not synced anywhere. Clearing your browser data, switching browsers, or
            moving to another device loses it for good.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onMigrate}
            className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Move to Supabase
          </button>
          <button
            type="button"
            onClick={onMigrateGoogle}
            disabled={!GOOGLE_SIGNIN_ENABLED}
            title={GOOGLE_SIGNIN_ENABLED ? undefined : "Google sign-in isn't set up for this deployment"}
            className="self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
          >
            Move to Google Drive
          </button>
        </div>
      </Section>
    );
  }

  if (mode === "drive") {
    return (
      <Section title="Database">
        <Row
          label="Google Drive"
          description="Stored as one file in a “Waypoint” folder in your Drive."
          control={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {ownerLabel}
            </span>
          }
        />
      </Section>
    );
  }

  return (
    <Section title="Database">
      <Row
        label="Supabase project"
        description={
          supabaseConfig
            ? `${supabaseConfig.url.replace("https://", "").replace(".supabase.co", "")}${
                isCustomSupabaseProject ? "" : " (default)"
              }`
            : undefined
        }
        control={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {ownerLabel}
          </span>
        }
      />
      <button
        type="button"
        onClick={disconnectSupabaseProject}
        className="self-start text-xs text-muted-foreground hover:underline"
      >
        Sign out and use a different Supabase project
      </button>
    </Section>
  );
}

function LearningSection() {
  const [spaced, setSpaced] = useState(getSpacedRevisit);

  return (
    <Section title="Learning">
      <Row
        label="Spaced revisit"
        description={`When you finish every task in a topic, add review tasks for it after ${REVIEW_OFFSETS_DAYS.join(
          ", ",
        )} days (sooner if you rated it shaky, later if solid), in a “Reviews” topic on that track. At most ${MAX_OPEN_REVIEWS_PER_TRACK} stay open per track. Saved on this device only.`}
        control={
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={spaced}
              onChange={(e) => {
                setSpaced(e.target.checked);
                setSpacedRevisit(e.target.checked);
              }}
              className="h-4 w-4 accent-primary"
            />
            {spaced ? "On" : "Off"}
          </label>
        }
      />
    </Section>
  );
}

function AboutSection() {
  const native = isNative();
  const [nativeBuild, setNativeBuild] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [details, setDetails] = useState<UpdaterDiagnostics | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (native) void installedNativeBuild().then(setNativeBuild);
  }, [native]);

  useEffect(() => {
    if (native && showDetails) void getUpdaterDiagnostics().then(setDetails);
  }, [native, showDetails, result]);

  async function handleApply(bundleId: string) {
    setApplying(true);
    setApplyError(null);
    try {
      await applyStagedUpdate(bundleId);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Couldn't switch to the new version.");
      setApplying(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      setResult(await runUpdateCheck({ manual: true }));
    } finally {
      setChecking(false);
    }
  }

  const message = !result
    ? null
    : result.kind === "up-to-date"
      ? "You're on the latest version."
      : result.kind === "bundle-ready"
        ? `Version ${result.version} is downloaded and ready.`
        : result.kind === "native"
          ? `A new app version (${result.versionName}) is available. It's downloading now; follow the progress at the bottom of the screen.`
          : result.kind === "error"
            ? `Couldn't check: ${result.message}`
            : null;

  return (
    <Section title="About">
      <Row
        label={`Waypoint ${APP_VERSION}`}
        description={`Built ${new Date(BUILD_TIME).toLocaleDateString()}${
          native && nativeBuild ? ` · app build ${nativeBuild}` : ""
        }`}
        control={
          native ? (
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
            >
              {checking ? "Checking…" : "Check for updates"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Updates automatically</span>
          )
        }
      />
      {message && (
        <p className={`text-sm ${result?.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
      {result?.kind === "bundle-ready" && (
        <div>
          <button
            type="button"
            disabled={applying}
            onClick={() => void handleApply(result.bundleId)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {applying ? "Restarting…" : "Restart now to use it"}
          </button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Or leave it: it switches by itself the next time you leave the app.
          </p>
          {applyError && <p className="mt-1.5 text-xs text-destructive">{applyError}</p>}
        </div>
      )}
      {native && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showDetails ? "Hide update details" : "Update details"}
          </button>
          {showDetails && details && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-xs">
              <dt className="text-muted-foreground">Running build</dt>
              <dd className="font-mono">{new Date(details.runningBuildTime).toLocaleString()}</dd>
              <dt className="text-muted-foreground">Bundle</dt>
              <dd className="break-all font-mono">
                {details.currentBundleId} ({details.currentBundleVersion})
              </dd>
              <dt className="text-muted-foreground">Waiting</dt>
              <dd className="break-all font-mono">{details.nextBundleId ?? "none"}</dd>
              <dt className="text-muted-foreground">Downloaded</dt>
              <dd className="font-mono">
                {details.bundles.length === 0
                  ? "none"
                  : details.bundles.map((b) => `${b.version} ${b.status}`).join(", ")}
              </dd>
              <dt className="text-muted-foreground">App build</dt>
              <dd className="font-mono">{details.nativeBuild}</dd>
              {details.problem && (
                <>
                  <dt className="text-destructive">Problem</dt>
                  <dd className="text-destructive">{details.problem}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}
    </Section>
  );
}

function FocusSection() {
  const [settings, setSettings] = useState(getFocusSettings);

  function update(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setFocusSettings(next);
  }

  const field =
    "w-16 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring";

  return (
    <Section title="Focus timer">
      <Row
        label="Focus block"
        description="Minutes of focused work in one block. Applies to the next block you start."
        control={
          <input
            type="number"
            min={1}
            max={180}
            value={settings.focusMinutes}
            onChange={(e) => update({ focusMinutes: Math.min(180, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
            className={field}
            aria-label="Focus minutes"
          />
        }
      />
      <Row
        label="Break"
        description="Minutes of rest after a block. 0 skips the break. Saved on this device only."
        control={
          <input
            type="number"
            min={0}
            max={60}
            value={settings.breakMinutes}
            onChange={(e) => update({ breakMinutes: Math.min(60, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
            className={field}
            aria-label="Break minutes"
          />
        }
      />
    </Section>
  );
}

function DataSection() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleRestore() {
    if (!backend || !pending) return;
    setBusy(true);
    setError(null);
    try {
      const counts = await backend.importSnapshot(pending.snapshot);
      await queryClient.invalidateQueries();
      setNotice(
        `Restored ${counts.tracks} track${counts.tracks === 1 ? "" : "s"}, ${counts.tasks} task${
          counts.tasks === 1 ? "" : "s"
        } and ${counts.notes} note${counts.notes === 1 ? "" : "s"}.`,
      );
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore the backup. Nothing was added.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBackup() {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      const snap = await backend.snapshot({ notes: true });
      downloadTextFile(backupFileName(), snapshotToBackupJson(snap), "application/json");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the backup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Your data">
      <Row
        label="Download a backup"
        description="Every track, topic, task and note as one JSON file. Images and audio inside notes aren't included. To move a single track, use Export on its page — it's a Markdown file Import can read back."
        control={
          <button
            type="button"
            onClick={handleBackup}
            disabled={busy || !backend}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Download .json"}
          </button>
        }
      />
      <Row
        label="Restore from a backup"
        description="Adds everything in a backup file as new tracks and notes. Nothing you already have is changed or replaced, so restoring into an account that holds the same data gives you a second copy."
        control={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy || !backend}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
            >
              Choose file…
            </button>
          </>
        }
      />
      {pending && (
        <div className="rounded-md border border-border bg-card px-3 py-3">
          <p className="text-sm font-medium">Ready to restore</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pending.snapshot.tracks.length} track{pending.snapshot.tracks.length === 1 ? "" : "s"},{" "}
            {pending.snapshot.topics.length} topic{pending.snapshot.topics.length === 1 ? "" : "s"},{" "}
            {pending.snapshot.tasks.length} task{pending.snapshot.tasks.length === 1 ? "" : "s"},{" "}
            {pending.snapshot.notes.length} note{pending.snapshot.notes.length === 1 ? "" : "s"}
            {pending.snapshot.cards.length > 0 &&
              `, ${pending.snapshot.cards.length} card${pending.snapshot.cards.length === 1 ? "" : "s"}`}
            {pending.exportedAt && ` · exported ${new Date(pending.exportedAt).toLocaleString()}`}
            {pending.skipped > 0 && ` · ${pending.skipped} unreadable row${pending.skipped === 1 ? "" : "s"} skipped`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Images and audio inside notes aren't part of a backup, so they won't show up.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {notice && <p className="text-sm text-success">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Section>
  );
}

export function Settings() {
  const { mode } = useBackend();
  const location = useLocation();
  const navigate = useNavigate();
  const [migrating, setMigrating] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Google sign-in is a full-page redirect, so a "Move to Google Drive"
  // click can't stay inside GuestMigrationDialog the way Supabase's
  // in-place email/password form does — it leaves the app entirely and
  // comes back through /auth/google/callback. That callback marks the
  // returning navigation with this state once it's adopted the new
  // session, so the dialog can pick up on the import step rather than
  // making the user find the button again.
  const resumeMigration = Boolean((location.state as { resumeMigration?: boolean } | null)?.resumeMigration);

  useEffect(() => {
    if (resumeMigration && mode === "drive") {
      setMigrating(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [resumeMigration, mode, navigate, location.pathname]);

  async function handleMigrateGoogle() {
    markGoogleMigration();
    setGoogleError(null);
    try {
      await startGoogleSignIn();
    } catch (error) {
      clearGoogleMigration();
      setGoogleError(error instanceof Error ? error.message : "Couldn't start Google sign-in.");
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Settings</h1>

      <div className="mt-7 max-w-lg">
        <Section title="Appearance">
          <Row label="Theme" control={<ThemeToggle />} />
        </Section>

        <LearningSection />

        <FocusSection />

        <AboutSection />

        <DataSection />

        <DatabaseSection onMigrate={() => setMigrating(true)} onMigrateGoogle={handleMigrateGoogle} />
        {googleError && <p className="mt-3 text-sm text-destructive">{googleError}</p>}
      </div>

      {migrating && <GuestMigrationDialog onClose={() => setMigrating(false)} />}
    </AppShell>
  );
}
