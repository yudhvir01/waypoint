import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { marked } from "marked";
import { stripFrontMatter } from "../lib/frontMatter";
import { loadSupabaseConfig } from "../lib/supabaseConfig";

import welcomeRaw from "../../docs/writebook/01-welcome.md?raw";
import connectRaw from "../../docs/writebook/02-connecting-your-supabase-project.md?raw";
import importRaw from "../../docs/writebook/03-the-markdown-import-format.md?raw";

const CHAPTERS = [
  { slug: "welcome", raw: welcomeRaw },
  { slug: "connecting-your-supabase-project", raw: connectRaw },
  { slug: "the-markdown-import-format", raw: importRaw },
].map(({ slug, raw }) => {
  const { title, body } = stripFrontMatter(raw);
  return { slug, title, html: marked.parse(body, { async: false }) };
});

export function Guide() {
  const { hash } = useLocation();
  const [backTo, setBackTo] = useState<string>("/connect");

  useEffect(() => {
    setBackTo(loadSupabaseConfig() ? "/login" : "/connect");
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to={backTo} className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>

      <div className="mt-6 flex flex-col gap-2 border-b border-border pb-6 text-sm">
        <span className="font-medium text-foreground">On this page</span>
        {CHAPTERS.map((c) => (
          <a key={c.slug} href={`#${c.slug}`} className="text-primary hover:underline">
            {c.title}
          </a>
        ))}
      </div>

      {CHAPTERS.map((c) => (
        <section key={c.slug} id={c.slug} className="scroll-mt-8 border-b border-border py-10 last:border-0">
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: c.html }}
          />
        </section>
      ))}
    </div>
  );
}
