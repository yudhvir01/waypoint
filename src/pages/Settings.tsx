import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ThemeToggle } from "../components/ThemeToggle";
import { GuestMigrationDialog } from "../components/GuestMigrationDialog";
import { useBackend } from "../context/BackendProvider";

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

function DatabaseSection({ onMigrate }: { onMigrate: () => void }) {
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
        <button
          type="button"
          onClick={onMigrate}
          className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Move to Supabase
        </button>
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

export function Settings() {
  const [migrating, setMigrating] = useState(false);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Settings</h1>

      <div className="mt-7 max-w-lg">
        <Section title="Appearance">
          <Row label="Theme" control={<ThemeToggle />} />
        </Section>

        <DatabaseSection onMigrate={() => setMigrating(true)} />
      </div>

      {migrating && <GuestMigrationDialog onClose={() => setMigrating(false)} />}
    </AppShell>
  );
}
