import { useState } from "react";

interface SchedulePopoverProps {
  currentDueDate: string | null;
  onSave: (patch: { dueDate: string | null }) => void;
  onClose: () => void;
}

export function SchedulePopover({ currentDueDate, onSave, onClose }: SchedulePopoverProps) {
  const [dueDate, setDueDate] = useState(currentDueDate ?? "");

  function handleSave() {
    onSave({ dueDate: dueDate || null });
    onClose();
  }

  function handleRemoveDeadline() {
    onSave({ dueDate: null });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">Deadline</h3>

        <label className="mt-3 flex flex-col gap-1 text-sm">
          Deadline
          <input
            autoFocus
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {currentDueDate && (
              <button
                type="button"
                onClick={handleRemoveDeadline}
                className="rounded-md px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-accent"
              >
                Remove deadline
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
