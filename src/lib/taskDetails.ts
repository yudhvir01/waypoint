// A task's title is one glanceable line; anything longer lives in the
// task's own note (its "details"). The importer splits long lines into the
// two, and every backend turns the details into that note.

// Past this a title stops being scannable in a list, so it gets split.
export const TITLE_SOFT_LIMIT = 80;
// Details are plain text with "\n" between lines and "- " marking a bullet.
export const MAX_DETAILS_CHARS = 100_000;

const MIN_HEAD = 8;
// Tried in order: the first that leaves a sensible short head wins.
const SEPARATORS = [": ", " — ", " – ", " - ", "; ", ". "];

export function splitLongTitle(title: string): { title: string; details: string | null } {
  if (title.length <= TITLE_SOFT_LIMIT) return { title, details: null };

  for (const sep of SEPARATORS) {
    const at = title.indexOf(sep);
    if (at < MIN_HEAD || at > TITLE_SOFT_LIMIT) continue;
    const rest = title.slice(at + sep.length).trim();
    if (!rest) continue;
    return { title: title.slice(0, at).trim(), details: rest };
  }

  // A parenthetical keeps its brackets in the details.
  const paren = title.indexOf(" (");
  if (paren >= MIN_HEAD && paren <= TITLE_SOFT_LIMIT) {
    return { title: title.slice(0, paren).trim(), details: title.slice(paren + 1).trim() };
  }

  // No natural break: cut at a word and keep the whole line as the details.
  const cut = title.lastIndexOf(" ", TITLE_SOFT_LIMIT - 1);
  const head = title.slice(0, cut >= MIN_HEAD ? cut : TITLE_SOFT_LIMIT - 1).replace(/[\s,;:.\-–—]+$/, "");
  return { title: `${head}…`, details: title };
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The note editor stores HTML; build the paragraphs and bullet lists it
// understands from the importer's plain-text details.
export function detailsToHtml(details: string): string {
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(`<ul>${bullets.map((b) => `<li><p>${b}</p></li>`).join("")}</ul>`);
    bullets = [];
  };
  for (const line of details.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("- ")) {
      bullets.push(escapeHtml(line.slice(2)));
    } else {
      flush();
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  flush();
  return out.join("");
}
