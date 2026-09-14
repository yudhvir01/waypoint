import { useEffect } from "react";
import { Link } from "react-router-dom";
import { marked } from "marked";
import { stripFrontMatter } from "../lib/frontMatter";
import { useBackend } from "../context/BackendProvider";
import { LogoMark } from "./Logo";

// Shared chrome for /privacy and /terms — plain, reachable with or
// without a session, since both a signed-out Google OAuth reviewer and a
// signed-in user (linked from AppShell's sidebar) need to open these.
export function LegalPage({ raw }: { raw: string }) {
  const { title, body } = stripFrontMatter(raw);
  const html = marked.parse(body, { async: false });
  const { backend } = useBackend();
  // Signed-in visitors go straight back to the dashboard; signed-out ones
  // go to the picker — either way, no bouncing through a redirect first.
  const backTo = backend ? "/" : "/login";

  useEffect(() => {
    document.title = `${title} — Waypoint`;
  }, [title]);

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
