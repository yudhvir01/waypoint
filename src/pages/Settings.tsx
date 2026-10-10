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
import { getSpacedRevisit, setSpacedRevisit } from "../lib/preferences";
import { backupFileName, downloadTextFile, snapshotToBackupJson } from "../lib/exportData";
import { MAX_OPEN_REVIEWS_PER_TRACK, REVIEW_OFFSETS_DAYS } from "../lib/taskActions";
import { parseBackup, type ParsedBackup } from "../lib/backup";

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

        <DataSection />

        <DatabaseSection onMigrate={() => setMigrating(true)} onMigrateGoogle={handleMigrateGoogle} />
        {googleError && <p className="mt-3 text-sm text-destructive">{googleError}</p>}
      </div>

      {migrating && <GuestMigrationDialog onClose={() => setMigrating(false)} />}
    </AppShell>
  );
}
