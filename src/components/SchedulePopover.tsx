import { useState } from "react";
import { REMINDER_LEAD_OPTIONS } from "../lib/database.types";

interface SchedulePopoverProps {
  variant: "date" | "reminder";
  currentDueDate: string | null;
  currentReminderLeadDays: number | null;
  onSave: (patch: { dueDate?: string | null; reminderLeadDays?: number | null }) => void;
  onClose: () => void;
}

export function SchedulePopover({
  variant,
  currentDueDate,
  currentReminderLeadDays,
  onSave,
  onClose,
}: SchedulePopoverProps) {
  const needsDate = variant === "reminder" && !currentDueDate;
  const [dueDate, setDueDate] = useState(currentDueDate ?? "");
  const [leadDays, setLeadDays] = useState(currentReminderLeadDays ?? 1);

  function handleSave() {
    if (variant === "date") {
      // Clearing the date also clears any reminder — a reminder can't
      // exist without a date to count backwards from.
      onSave(dueDate ? { dueDate } : { dueDate: null, reminderLeadDays: null });
    } else if (needsDate) {
      if (!dueDate) return;
      onSave({ dueDate, reminderLeadDays: leadDays });
    } else {
      onSave({ reminderLeadDays: leadDays });
    }
    onClose();
  }

  function handleRemoveDeadline() {
    onSave({ dueDate: null, reminderLeadDays: null });
    onClose();
  }

  function handleRemoveReminder() {
    onSave({ reminderLeadDays: null });
    onClose();
  }

  const title =
    variant === "date" ? "Deadline" : needsDate ? "Set deadline & reminder" : "Reminder";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">{title}</h3>

        {(variant === "date" || needsDate) && (
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
        )}

        {variant === "reminder" && (
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Remind me
            <select
              value={leadDays}
              onChange={(e) => setLeadDays(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              {REMINDER_LEAD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {variant === "date" && currentDueDate && (
              <button
                type="button"
                onClick={handleRemoveDeadline}
                className="rounded-md px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-accent"
              >
                Remove deadline
              </button>
            )}
            {variant === "reminder" && !needsDate && currentReminderLeadDays !== null && (
              <button
                type="button"
                onClick={handleRemoveReminder}
                className="rounded-md px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-accent"
              >
                Remove reminder
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
              disabled={needsDate && !dueDate}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {variant === "date" ? "Save" : needsDate ? "Set" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
