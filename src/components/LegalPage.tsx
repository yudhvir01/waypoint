import { useEffect } from "react";
import { Link } from "react-router-dom";
import { marked } from "marked";
import { stripFrontMatter } from "../lib/frontMatter";
import { useBackend } from "../context/BackendProvider";
import { LogoMark } from "./Logo";
import { SiteFooter, SiteHeader } from "./SiteChrome";

// Shared chrome for /privacy and /terms — plain, reachable with or
// without a session, since both a signed-out Google OAuth reviewer and a
// signed-in user (linked from AppShell's sidebar) need to open these.
export function LegalPage({ raw }: { raw: string }) {
  const { ready, backend } = useBackend();
  const { title, body } = stripFrontMatter(raw);
  const html = marked.parse(body, { async: false });
  // Both signed-in and signed-out visitors return to "/", which shows the
  // dashboard or the landing page respectively.
  const backTo = "/";

  useEffect(() => {
    document.title = `${title} — Waypoint`;
  }, [title]);

  if (!ready) return null;

  // Signed out: part of the public website, like the landing page and guide.
  if (!backend) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <section className="bg-[#f4f4f5] dark:bg-[#0b0b0b]">
          <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{title}</h1>
          </div>
        </section>
        <main className="mx-auto max-w-3xl px-6 py-14">
          <article className="prose dark:prose-invert prose-a:text-primary" dangerouslySetInnerHTML={{ __html: html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, "") }} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12 sm:px-8">
      <Link to={backTo} className="flex items-center gap-2.5">
        <LogoMark size={22} />
        <span className="text-[15px] font-semibold tracking-tight">Waypoint</span>
      </Link>

      <div
        className="prose prose-sm mt-10 max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="mt-12 flex gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link to="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:underline">
          Terms of Service
        </Link>
        <Link to={backTo} className="hover:underline">
          ← Back to Waypoint
        </Link>
      </div>
    </div>
  );
}
