import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBackend } from "../context/BackendProvider";
import { SupabaseAuthPanel } from "./SupabaseAuthPanel";
import { GuestBackend } from "../lib/backend/guestBackend";
import { clearGuestData } from "../lib/backend/guestStore";
import type { ParsedImport } from "../lib/markdownImport";

// Guest data and the newly-connected Supabase account are two different
// backends, so migrating is: read every guest track out as the same
// ParsedImport shape the Markdown importer already produces, then hand
// each one to the new backend's importTrack() — no separate copy path to
// maintain, and each track either fully imports or fully doesn't.
export function GuestMigrationDialog({ onClose }: { onClose: () => void }) {
  const { backend, mode } = useBackend();
  const navigate = useNavigate();
  const [step, setStep] = useState<"connect" | "import" | "done">("connect");
  const [pending, setPending] = useState<ParsedImport[] | null>(null);
  const [imported, setImported] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [clearAfter, setClearAfter] = useState(true);

  useEffect(() => {
    if (step !== "import" || pending) return;
    new GuestBackend().exportAllAsImports().then(setPending);
  }, [step, pending]);

  async function runImport() {
    if (!pending || !backend) return;
    setImporting(true);
    const failures: string[] = [];
    let count = 0;
    for (const parsed of pending) {
      try {
        await backend.importTrack(parsed);
        count++;
        setImported(count);
      } catch {
        failures.push(parsed.trackName);
      }
    }
    setFailed(failures);
    if (failures.length === 0 && clearAfter) {
      await clearGuestData();
    }
    setImporting(false);
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "connect" && (
          <SupabaseAuthPanel
            cancelLabel="← Cancel"
            onCancel={onClose}
            onConnected={() => setStep("import")}
          />
        )}

        {step === "import" && (
          <div>
            <h2 className="text-lg font-semibold">Move your guest tracks</h2>
            {!pending ? (
              <p className="mt-3 text-sm text-muted-foreground">Reading your guest data…</p>
            ) : pending.length === 0 ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  No guest tracks found — you're all set on Supabase already.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="mt-5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Go to Waypoint
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Found {pending.length} guest track{pending.length === 1 ? "" : "s"} in this
                  browser. Importing copies them into your Supabase account — nothing here is
                  touched until you confirm.
                </p>
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={clearAfter}
                    onChange={(e) => setClearAfter(e.target.checked)}
                    disabled={importing}
                  />
                  Clear this browser's guest data once the import succeeds
                </label>
                {importing && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Imported {imported} of {pending.length}…
                  </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={importing}
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    onClick={runImport}
                    disabled={importing}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    {importing ? "Importing…" : `Import ${pending.length} track${pending.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === "done" && (
          <div>
            <h2 className="text-lg font-semibold">
              {failed.length === 0 ? "All done" : "Imported with some failures"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {imported} track{imported === 1 ? "" : "s"} imported into your Supabase account
              {mode === "supabase" ? "" : " — sign in again to see them"}.
            </p>
            {failed.length > 0 && (
              <p className="mt-2 text-sm text-destructive">
                Couldn't import: {failed.join(", ")}. Your guest copy of these was left in place —
                try again from here later.
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="mt-5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Go to Waypoint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
