// Supabase Edge Function: link-preview
//
// Pasting a bare URL into a note shows a Signal-style preview card (title,
// description, image) instead of the raw link. Getting that requires
// fetching the page's <head> server-side — almost no site sends
// Access-Control-Allow-Origin, so the browser can't do this fetch itself.
// This function is a thin, stateless proxy for exactly that: given a URL,
// it fetches the page and hands back whatever og:/twitter:/plain <title>
// metadata it finds. It keeps no state and needs no database.
//
// Deploy with `--no-verify-jwt`, same reasoning as google-token: guest and
// Drive users have no Supabase session to attach, and this endpoint reveals
// nothing sensitive — it only ever returns metadata about a URL the caller
// already has.
//
//   supabase functions deploy link-preview --no-verify-jwt
//
// No secrets required.
//
// Because this fetches whatever URL a caller sends, it's a classic SSRF
// shape — the checks below block the obvious ways to point it at internal
// infrastructure (literal private/loopback/link-local addresses, and
// redirects that land on one), but this is a basic mitigation, not a
// hardened network boundary: it does not resolve DNS itself to check where
// a public hostname actually points (DNS rebinding), because the Edge
// runtime doesn't expose a DNS API to do that check before fetch() commits
// to it.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const FETCH_TIMEOUT_MS = 6_000;
const MAX_BODY_BYTES = 1_000_000; // 1 MB is far more than any <head> needs
const MAX_REDIRECTS = 3;

// Blocks the address literally being loopback/private/link-local. Doesn't
// catch a public hostname that *resolves* to one (see module comment).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;

  // IPv4 literal
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 0) return true;
    return false;
  }

  // IPv6 literal (bracketed hostnames arrive without brackets here)
  if (h.includes(":")) {
    if (h === "::1") return true; // loopback
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true; // link-local / unique-local
    return false;
  }

  return false;
}

function parseSafeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

async function fetchWithLimits(url: URL): Promise<{ finalUrl: string; contentType: string; body: string }> {
  let current = url;
  for (let redirects = 0; ; redirects++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Identifies the fetch as a link-unfurl, and asks for HTML —
          // some sites serve a lighter page to non-browser UAs.
          "User-Agent": "WaypointLinkPreview/1.0 (+https://github.com/)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || redirects >= MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }
      const next = parseSafeUrl(new URL(location, current).toString());
      if (!next) throw new Error("Redirected to a blocked address.");
      current = next;
      continue;
    }

    if (!res.ok) throw new Error(`Fetch failed (${res.status}).`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("Not an HTML page.");
    }

    const reader = res.body?.getReader();
    if (!reader) return { finalUrl: current.toString(), contentType, body: "" };
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.length === 1 ? chunks[0] : concat(chunks),
    );
    return { finalUrl: current.toString(), contentType, body };
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// Deliberately not a real HTML parser — Deno's Edge runtime has none
// built in, and pulling one in for a handful of <meta> tags isn't worth
// it. These patterns only need to survive real-world <head> markup, not
// adversarial HTML, since the result is just a title/description/image
// shown back to the person who pasted the link.
function extractMeta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']|` +
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,
      "i",
    );
    const match = html.match(re);
    const value = match?.[1] ?? match?.[2];
    if (value) return decodeEntities(value.trim());
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function isYouTubeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "youtu.be" || h === "youtube.com" || h.endsWith(".youtube.com");
}

async function fetchYouTubeOEmbed(
  pageUrl: string,
): Promise<{ title: string; description: string | null; image: string | null; siteName: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    if (!data.title) return null;
    return {
      title: data.title,
      description: data.author_name ?? null,
      image: data.thumbnail_url ?? null,
      siteName: "YouTube",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const raw = (body as { url?: unknown } | null)?.url;
  if (typeof raw !== "string" || !raw) return json({ error: "invalid_request" }, 400);

  const url = parseSafeUrl(raw);
  if (!url) return json({ error: "blocked_url", message: "That URL can't be previewed." }, 400);

  try {
    const { finalUrl, body: html } = await fetchWithLimits(url);
    const title = extractMeta(html, "og:title", "twitter:title") ?? extractTitle(html);
    const description = extractMeta(html, "og:description", "twitter:description", "description");
    let image = extractMeta(html, "og:image", "twitter:image");
    if (image) {
      try {
        image = new URL(image, finalUrl).toString();
      } catch {
        image = null;
      }
    }
    const siteName = extractMeta(html, "og:site_name") ?? new URL(finalUrl).hostname;

    // YouTube sometimes serves a server-side fetch its generic homepage
    // <head> (title "- YouTube", no image) even for a public video, so a
    // page with no og:image there can't be trusted. oEmbed is YouTube's
    // supported way to get a video's real title and thumbnail.
    if (!image && isYouTubeHost(new URL(finalUrl).hostname)) {
      const oembed = await fetchYouTubeOEmbed(finalUrl);
      if (oembed) return json({ url: finalUrl, ...oembed });
    }

    return json({ url: finalUrl, title, description, image, siteName });
  } catch (err) {
    return json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "Couldn't load a preview." },
      502,
    );
  }
});
