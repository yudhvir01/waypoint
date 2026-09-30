// Client side of supabase/functions/link-preview — see that function's
// header for why this has to be a server-side fetch at all.
export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

// `endpointUrl` is the full URL of a deployed link-preview function — see
// env.ts's LINK_PREVIEW_URL for how that's resolved (it isn't always the
// currently-connected Supabase project's own function).
export async function fetchLinkPreview(endpointUrl: string, targetUrl: string): Promise<LinkPreviewData> {
  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl }),
  });
  const data = (await res.json().catch(() => null)) as (LinkPreviewData & { message?: string }) | null;
  if (!res.ok) throw new Error(data?.message ?? "Couldn't load a preview.");
  if (!data) throw new Error("Couldn't load a preview.");
  return data;
}

// True (and returns the normalized URL) only when the whole pasted string
// is one http(s) link and nothing else — pasting a URL in the middle of a
// sentence should stay plain text, not turn into a card.
export function soleUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
