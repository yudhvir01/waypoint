// Every guide chapter opens with a "## TL;DR" list. On the page it's set
// apart as a box, so the short version reads first and the detail after.
const TLDR = /<h2[^>]*>TL;DR<\/h2>\s*(<ul>[\s\S]*?<\/ul>)/;

export function boxTldr(html: string): string {
  return html.replace(
    TLDR,
    '<div class="not-prose my-6 rounded-lg border border-primary/25 bg-primary/5 px-5 py-4">' +
      '<p class="text-xs font-semibold uppercase tracking-wider text-primary">TL;DR</p>' +
      '<div class="tldr mt-2 text-[15px] leading-relaxed [&_li]:mt-1.5 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[13px]">$1</div>' +
      "</div>",
  );
}
