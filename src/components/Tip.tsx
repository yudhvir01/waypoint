import { useState, type ReactNode } from "react";

const key = (id: string) => `waypoint.tip.${id}`;

function dismissed(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === "1";
  } catch {
    return false;
  }
}

// A short explanation shown where a feature lives, the first time someone
// gets there. "Got it" hides it for good on this device, so it teaches once
// and then stays out of the way.
export function Tip({ id, title, children, className = "" }: { id: string; title: string; children: ReactNode; className?: string }) {
  const [hidden, setHidden] = useState(() => dismissed(id));
  if (hidden) return null;

  return (
    <div role="note" className={`rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-foreground">{title}</p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(key(id), "1");
            } catch {
              // Private windows can refuse storage; it just shows again next time.
            }
            setHidden(true);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          Got it
        </button>
      </div>
      <div className="mt-1.5 text-muted-foreground [&_b]:font-medium [&_b]:text-foreground [&_li]:mt-1 [&_ul]:ml-4 [&_ul]:list-disc">
        {children}
      </div>
    </div>
  );
}
