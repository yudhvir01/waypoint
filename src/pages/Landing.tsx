import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "../components/Logo";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

// Page-local palette. Signal-style: a soft periwinkle hero band and pastel
// feature panels in light mode. Dark mode is its own design rather than a
// darkened copy: the app's AMOLED black makes borders and cards disappear
// on a marketing page, so the landing page sits on a deep midnight blue
// with luminous gradient panels, and re-points the shared tokens
// (background, card, border…) at it so every component below follows.
const css = `
.lp {
  --lp-hero: #9db8f8;
  --lp-cta: #9db8f8;
  --lp-panel-a: #a7c9d6;
  --lp-panel-b: #cdb4e0;
  --lp-panel-c: #f6c9a8;
  --lp-section: #f4f4f5;
  --lp-phone: #1b1b1f;
  --lp-panel-ring: transparent;
}
.dark .lp {
  --background: #0a0f1f;
  --card: #111a31;
  --muted: #18233f;
  --accent: #18233f;
  --border: #26345a;
  --muted-foreground: #a3b0cc;

  --lp-hero: linear-gradient(180deg, #1f3282 0%, #162456 55%, #0a0f1f 100%);
  --lp-cta: radial-gradient(90% 140% at 50% 0%, #26409a 0%, #162456 55%, #0a0f1f 100%);
  --lp-panel-a: linear-gradient(135deg, #14505f 0%, #0d2d45 100%);
  --lp-panel-b: linear-gradient(135deg, #4a3590 0%, #261a52 100%);
  --lp-panel-c: linear-gradient(135deg, #8a4a2c 0%, #4a2236 100%);
  --lp-section: #0d1428;
  --lp-phone: #05070f;
  --lp-panel-ring: rgba(255, 255, 255, 0.1);
}
.lp .lp-panel {
  box-shadow: inset 0 0 0 1px var(--lp-panel-ring);
}
.dark .lp .lp-hero-copy p {
  color: #d3dcf2;
}
.dark .lp .lp-phone {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 28px 60px -16px rgba(0, 0, 0, 0.7);
}
.dark .lp .lp-card {
  transition: border-color 0.2s, transform 0.2s;
}
.dark .lp .lp-card:hover {
  border-color: #3b4f86;
  transform: translateY(-2px);
}
`;

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Phone({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={`lp-phone relative w-[210px] rounded-[2.2rem] border-[7px] bg-black p-0 shadow-2xl sm:w-[250px] ${className}`}
      style={{ borderColor: "var(--lp-phone)", ...style }}
    >
      <div className="absolute left-1/2 top-1.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[1.7rem] bg-background px-3 pb-5 pt-9 text-foreground">{children}</div>
    </div>
  );
}

function FocusScreen() {
  const rows = [
    { t: "Finish onboarding flow", p: 80, done: true },
    { t: "Read chapter 4", p: 45, done: false },
    { t: "Plan next sprint", p: 20, done: false },
    { t: "Draft launch notes", p: 60, done: false },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <LogoMark size={20} />
        <span className="text-sm font-semibold">Focus Now</span>
      </div>
      {rows.map((r) => (
        <div key={r.t} className="rounded-xl border border-border bg-card p-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                r.done ? "border-teal bg-teal text-white" : "border-border"
              }`}
            >
              {r.done && <Check />}
            </span>
            <span className="text-xs font-medium">{r.t}</span>
          </div>
          <div className="ml-6 mt-2 h-1 rounded-full bg-muted">
            <div className="h-1 rounded-full bg-teal" style={{ width: `${r.p}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoteScreen() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>←</span>
        <span className="font-medium text-foreground">Design review</span>
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
        Tighten the onboarding copy — keep it under two lines.
      </div>
      <div className="self-end rounded-2xl rounded-tr-sm bg-muted px-3 py-2 text-xs">☑ Update empty states</div>
      <div className="h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-teal/40" />
      <div className="rounded-2xl rounded-tl-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
        🔗 waypoint.app/guide
      </div>
      <div className="mt-1 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground">Write a note…</div>
    </div>
  );
}

function FeatureRow({
  title,
  body,
  panel,
  children,
  reverse = false,
}: {
  title: string;
  body: string;
  panel: string;
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-[1fr_1.5fr] md:gap-16">
      <div className={reverse ? "md:order-2" : ""}>
        <h3 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h3>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div
        className={`lp-panel flex min-h-[18rem] items-center justify-center rounded-3xl p-8 ${reverse ? "md:order-1" : ""}`}
        style={{ background: `var(${panel})` }}
      >
        {children}
      </div>
    </div>
  );
}

function Pill({ children, tone = "bg-card" }: { children: ReactNode; tone?: string }) {
  return <div className={`rounded-2xl border border-border px-4 py-2.5 text-sm font-medium shadow-sm ${tone}`}>{children}</div>;
}

const CARDS = [
  { title: "Your storage, your rules", body: "Keep everything in your own Supabase project or a Waypoint folder in Google Drive.", icon: <path d="M12 2.5 19.5 6v5.5c0 4.6-3.2 8.2-7.5 10-4.3-1.8-7.5-5.4-7.5-10V6L12 2.5Z" /> },
  { title: "Try it as a guest", body: "No account needed to look around. Sign in later and bring your tracks with you.", icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-7 8-7s8 3 8 7" /> },
  { title: "Notes with attachments", body: "Images, links and files sit right inside the note they belong to.", icon: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" /> },
  { title: "Phone and web", body: "Use it in the browser, or install the native app on Android and iOS.", icon: <path d="M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM11 18h2" /> },
];

export function Landing() {
  return (
    <div className="lp min-h-screen overflow-x-hidden bg-background">
      <style>{css}</style>

      <SiteHeader />

      {/* Hero band */}
      <section style={{ background: "var(--lp-hero)" }} className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-6 pt-14 md:min-h-[34rem] md:grid-cols-2 md:pt-0">
          <div className="lp-hero-copy pb-6 md:pb-0">
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">Plan Freely</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed">
              Say &quot;hello&quot; to a calmer way to keep notes and goals. An unexpected focus on privacy,
              combined with all of the features you expect.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-block rounded-lg bg-white px-6 py-3 text-base font-semibold text-[#2f55d4] shadow-sm transition-transform hover:scale-[1.03]"
            >
              Sign in or Sign up
            </Link>
          </div>

          <div className="-mb-24 flex items-start justify-center pb-0 pt-6 md:-mb-32 md:pt-14">
            <Phone className="-mr-6 mt-8 -rotate-[8deg]">
              <FocusScreen />
            </Phone>
            <Phone className="rotate-[6deg]" style={{ zIndex: 2 }}>
              <NoteScreen />
            </Phone>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="px-6 pb-8 pt-32 text-center md:pt-40">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Why use Waypoint?</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Explore below to see why Waypoint is a simple, powerful, and private place for your notes.
        </p>
      </section>

      <FeatureRow
        panel="--lp-panel-a"
        title="One Dashboard, Every Goal"
        body="Tracks, tasks and notes live together. Focus Now surfaces what to do next, so you spend your time doing, not organizing."
      >
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Pill>🎯 Focus Now</Pill>
          <Pill tone="bg-primary/10 self-end">Learn Rust · 3 tasks</Pill>
          <Pill>Ship v2 · 5 tasks</Pill>
          <Pill tone="bg-teal/20 self-end">✓ Weekly review done</Pill>
        </div>
      </FeatureRow>

      <FeatureRow
        reverse
        panel="--lp-panel-b"
        title="Write Without Friction"
        body="A rich editor with images, links and attachments. Drag, drop, resize — your notes stay tied to the task they came from."
      >
        <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-md">
          <div className="h-3 w-2/3 rounded-full bg-foreground/80" />
          <div className="mt-4 h-2 w-full rounded-full bg-muted-foreground/30" />
          <div className="mt-2 h-2 w-5/6 rounded-full bg-muted-foreground/30" />
          <div className="mt-4 h-24 rounded-xl bg-gradient-to-br from-primary/40 to-teal/50" />
          <div className="mt-4 h-2 w-3/4 rounded-full bg-muted-foreground/30" />
        </div>
      </FeatureRow>

      <FeatureRow
        panel="--lp-panel-c"
        title="Private By Design"
        body="Your data lives in storage you control. No ads, no tracking of your notes — privacy isn't a mode, it's how Waypoint works."
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card shadow-md">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="text-primary" aria-hidden="true">
              <path d="M12 2.5 19.5 6v5.5c0 4.6-3.2 8.2-7.5 10-4.3-1.8-7.5-5.4-7.5-10V6L12 2.5Z" />
              <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" />
            </svg>
          </div>
          <Pill>Your Supabase · Your Drive</Pill>
        </div>
      </FeatureRow>

      {/* Cards */}
      <section style={{ background: "var(--lp-section)" }} className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2">
          {CARDS.map((c) => (
            <div key={c.title} className="lp-card rounded-3xl border border-border bg-card p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                  {c.icon}
                </svg>
              </div>
              <h3 className="mt-5 text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download */}
      <section id="download" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Get the app</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          Download Waypoint straight from here — no store account needed.
        </p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          <div className="lp-card flex flex-col rounded-3xl border border-border bg-card p-8">
            <h3 className="text-xl font-bold">Android</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Download the APK and open it. If asked, allow installs from your browser for this one
              file.
            </p>
            <a
              href="/downloads/waypoint.apk"
              download="Waypoint.apk"
              className="mt-6 rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Download for Android
            </a>
          </div>
          <div className="lp-card flex flex-col rounded-3xl border border-border bg-card p-8">
            <h3 className="text-xl font-bold">iPhone &amp; iPad</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Apple only allows apps to be installed through its own channels, so on iOS install
              Waypoint from Safari: open this page, tap Share, then <strong>Add to Home Screen</strong>.
              It opens full-screen like a regular app.
            </p>
            <span className="mt-6 rounded-lg border border-border px-5 py-3 text-center text-sm font-medium text-muted-foreground">
              Safari → Share → Add to Home Screen
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--lp-cta)" }} className="px-6 py-16 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ready when you are</h2>
        <p className="mt-3">Create an account or hop in as a guest in seconds.</p>
        <Link
          to="/login"
          className="mt-7 inline-block rounded-lg bg-white px-6 py-3 text-base font-semibold text-[#2f55d4] shadow-sm transition-transform hover:scale-[1.03]"
        >
          Sign in or Sign up
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
