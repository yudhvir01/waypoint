import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { marked } from "marked";
import { stripFrontMatter } from "../lib/frontMatter";
import { useBackend } from "../context/BackendProvider";
import { GuideApp } from "./GuideApp";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

import welcomeRaw from "../../docs/writebook/01-welcome.md?raw";
import connectRaw from "../../docs/writebook/02-connecting-your-supabase-project.md?raw";
import importRaw from "../../docs/writebook/03-the-markdown-import-format.md?raw";
import googleDriveRaw from "../../docs/writebook/05-google-drive-setup.md?raw";

const CHAPTERS = [
  { slug: "welcome", raw: welcomeRaw },
  { slug: "connecting-your-supabase-project", raw: connectRaw },
  { slug: "the-markdown-import-format", raw: importRaw },
  { slug: "google-drive-setup", raw: googleDriveRaw },
].map(({ slug, raw }) => {
  const { title, body } = stripFrontMatter(raw);
  const html = marked.parse(body, { async: false });
  // First paragraph, tags stripped, doubles as the index blurb.
  const first = /<p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
  const summary = new DOMParser().parseFromString(first, "text/html").body.textContent?.trim() ?? "";
  return { slug, title, html, summary };
});

function Illustration() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden h-72 items-center justify-center rounded-2xl bg-[#3a63c8] shadow-lg md:flex"
    >
      <svg viewBox="0 0 400 240" className="h-full w-full p-6" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.5">
        <path d="M70 40h120v160H70z" />
        <path d="M70 70h120M70 100h120M70 130h80" strokeOpacity="0.5" />
        <path d="M210 60h110v130H210z" />
        <path d="M225 85h80M225 110h80M225 135h50" strokeOpacity="0.5" />
        <circle cx="330" cy="50" r="22" fill="white" fillOpacity="0.9" stroke="none" />
        <path d="M190 120h20" strokeDasharray="3 4" />
        <path d="m60 215 20-20 20 20" />
      </svg>
    </div>
  );
}

// Signed-out visitors read the guide as part of the public website;
// signed-in users get the original in-app layout.
export function Guide() {
  const { ready, backend } = useBackend();
  if (!ready) return null;
  return backend ? <GuideApp /> : <PublicGuide />;
}

function PublicGuide() {
  const { hash } = useLocation();
  const activeSlug = hash ? hash.slice(1) : "";
  const chapter = CHAPTERS.find((c) => c.slug === activeSlug);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = chapter ? `${chapter.title} — Waypoint Guide` : "Guide — Waypoint";
  }, [chapter]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero band, mirroring the docs landing: big title left, art right. */}
      <section className="bg-[#f4f4f5] dark:bg-[#0b0b0b]">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-2 md:py-14">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {chapter ? chapter.title : "Guide"}
            </h1>
            <p className="mt-5 text-lg">
              {chapter ? "Waypoint guide" : "Learn how to set up and get the most out of Waypoint"}
            </p>
          </div>
          <Illustration />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-14">
        {chapter ? (
          <div className="grid gap-10 md:grid-cols-[14rem_1fr]">
            <nav className="flex flex-col gap-1 text-sm md:sticky md:top-6 md:self-start">
              <Link to="/guide" className="mb-2 font-semibold text-primary hover:underline">
                ← All chapters
              </Link>
              {CHAPTERS.map((c) => (
                <Link
                  key={c.slug}
                  to={`/guide#${c.slug}`}
                  className={`rounded-md px-2 py-1.5 ${
                    c.slug === chapter.slug
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.title}
                </Link>
              ))}
            </nav>
            <article
              key={chapter.slug}
              className="prose max-w-3xl dark:prose-invert prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: chapter.html }}
            />
          </div>
        ) : (
          <>
            <h2 className="text-4xl font-extrabold tracking-tight">Chapters</h2>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed">
              Everything you need, from connecting your storage to importing existing notes. Each chapter
              stands on its own, so start wherever makes sense.
            </p>
            <div className="mt-10 grid gap-x-16 gap-y-10 md:grid-cols-2">
              {CHAPTERS.map((c) => (
                <div key={c.slug}>
                  <Link to={`/guide#${c.slug}`} className="text-base font-bold text-primary hover:underline">
                    {c.title}
                  </Link>
                  <p className="mt-3 text-sm leading-relaxed">{c.summary}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
