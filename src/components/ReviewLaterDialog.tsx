import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { Task } from "../lib/database.types";
import { fromDateKey } from "../lib/recurrence";
import { daysFromToday, REVIEW_CHOICES_DAYS, reviewTitle, scheduleTaskReview } from "../lib/taskActions";

function readable(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// "Review this again in…": adds a "Review: <task>" task, due on the day
// chosen, to the same topic. It stays off Today's suggestions until then.
export function ReviewLaterDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { backend } = useBackend();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const schedule = useMutation({
    mutationFn: (dueDate: string) => scheduleTaskReview(backend!, task, dueDate),
    onSuccess: () => {
      for (const key of ["tasks", "focusNow", "planned", "snapshot", "trackProgress", "topicProgress", "topics"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review later"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {schedule.isSuccess ? (
          <>
            <h2 className="text-[15px] font-semibold">Review added</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              “{reviewTitle(task.title)}” is due {readable(schedule.variables)}. It shows up on Today that day.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold">Review this again in…</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.title}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {REVIEW_CHOICES_DAYS.map((days) => (
                <button
                  key={days}
                  type="button"
                  disabled={schedule.isPending}
                  onClick={() => schedule.mutate(daysFromToday(days))}
                  className="rounded-md border border-border px-2 py-2 text-sm transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
                >
                  {days === 1 ? "1 day" : `${days} days`}
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (date) schedule.mutate(date);
              }}
            >
              <label className="text-sm text-muted-foreground" htmlFor="review-date">
                Or on
              </label>
              <input
                id="review-date"
                type="date"
                min={daysFromToday(1)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
              <button
                type="submit"
                disabled={!date || schedule.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                Set
              </button>
            </form>
            {schedule.isError && (
              <p className="mt-2 text-xs text-destructive">Couldn't add the review. Check your connection and try again.</p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Adds a “Review:” task to the same topic. The task itself isn't changed.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
