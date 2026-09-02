import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { marked } from "marked";
import { stripFrontMatter } from "../lib/frontMatter";
import { loadSupabaseConfig } from "../lib/supabaseConfig";
import { useSupabase } from "../context/SupabaseProvider";

import welcomeRaw from "../../docs/writebook/01-welcome.md?raw";
import connectRaw from "../../docs/writebook/02-connecting-your-supabase-project.md?raw";
import importRaw from "../../docs/writebook/03-the-markdown-import-format.md?raw";
import remindersRaw from "../../docs/writebook/04-reminders.md?raw";

const CHAPTERS = [
  { slug: "welcome", raw: welcomeRaw },
  { slug: "connecting-your-supabase-project", raw: connectRaw },
  { slug: "the-markdown-import-format", raw: importRaw },
  { slug: "reminders", raw: remindersRaw },
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
  const { session } = useSupabase();
  const [backTo, setBackTo] = useState<string>("/connect");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setBackTo(session ? "/" : loadSupabaseConfig() ? "/login" : "/connect");
  }, [session]);

  const activeSlug = hash ? hash.slice(1) : CHAPTERS[0].slug;
  const chapter = CHAPTERS.find((c) => c.slug === activeSlug) ?? CHAPTERS[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeSlug]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl">
      <aside
        className={`shrink-0 overflow-hidden border-r border-border transition-all duration-200 ${
          sidebarOpen ? "w-64" : "w-0 border-r-0"
        }`}
      >
        <div className="w-64 px-5 py-8">
          <p className="text-sm font-semibold text-foreground">Guide</p>
          <nav className="mt-4 flex flex-col gap-0.5 text-sm">
            {CHAPTERS.map((c) => (
              <Link
                key={c.slug}
                to={`/guide#${c.slug}`}
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

      <div className="min-w-0 flex-1 px-8 py-8">
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
            ← Back
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
