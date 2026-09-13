import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { marked } from "marked";
import { stripFrontMatter } from "../lib/frontMatter";
import { useBackend } from "../context/BackendProvider";

import welcomeRaw from "../../docs/writebook/01-welcome.md?raw";
import connectRaw from "../../docs/writebook/02-connecting-your-supabase-project.md?raw";
import importRaw from "../../docs/writebook/03-the-markdown-import-format.md?raw";
import remindersRaw from "../../docs/writebook/04-reminders.md?raw";
import googleDriveRaw from "../../docs/writebook/05-google-drive-setup.md?raw";

const CHAPTERS = [
  { slug: "welcome", raw: welcomeRaw },
  { slug: "connecting-your-supabase-project", raw: connectRaw },
  { slug: "the-markdown-import-format", raw: importRaw },
  { slug: "reminders", raw: remindersRaw },
  { slug: "google-drive-setup", raw: googleDriveRaw },
].map(({ slug, raw }) => {
  const { title, body } = stripFrontMatter(raw);
  return { slug, title, html: marked.parse(body, { async: false }) };
});

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

export function Guide() {
  const { hash } = useLocation();
  const { backend } = useBackend();
  const backTo = backend ? "/" : "/login";
  // Open by default on a screen wide enough to show it inline; closed by
  // default on a phone, where it would otherwise squeeze the actual
  // chapter content into a sliver — see the drawer treatment below.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const activeSlug = hash ? hash.slice(1) : CHAPTERS[0].slug;
  const chapter = CHAPTERS.find((c) => c.slug === activeSlug) ?? CHAPTERS[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeSlug]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl">
      {/* Below md this becomes an overlay drawer (fixed, off-canvas by
          default) instead of an inline column — at phone widths, an
          always-present 256px sidebar would leave almost nothing for the
          actual chapter text. At md+ it's the original inline column that
          the hamburger below just widens/collapses in place. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 -translate-x-full overflow-hidden border-r border-border bg-card transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width] ${
          sidebarOpen ? "translate-x-0 md:w-64" : "md:w-0 md:border-r-0"
        }`}
      >
        <div className="w-72 px-5 py-8 md:w-64">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Guide
            </p>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close chapter list"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden"
            >
              ✕
            </button>
          </div>
          <nav className="mt-4 flex flex-col gap-0.5 text-sm">
            {CHAPTERS.map((c) => (
              <Link
                key={c.slug}
                to={`/guide#${c.slug}`}
                onClick={() => setSidebarOpen(window.innerWidth >= 768)}
                className={`rounded-md px-2 py-1.5 transition-colors ${
                  c.slug === activeSlug
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c.title}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Hide chapter list" : "Show chapter list"}
            aria-pressed={sidebarOpen}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <MenuIcon />
          </button>
          <Link to={backTo} className="text-sm text-muted-foreground hover:underline">
            ← Back to Waypoint
          </Link>
        </div>

        <div
          key={chapter.slug}
          className="prose prose-sm mt-8 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: chapter.html }}
        />
      </div>
    </div>
  );
}
