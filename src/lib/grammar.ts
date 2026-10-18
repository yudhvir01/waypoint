// Grammar, spelling and style checking for notes, through LanguageTool's
// free public API. Text is only sent when the person presses Check, and
// the free API takes up to 20 KB a request and about 20 requests a minute.

export type GrammarIssue = {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  kind: "spelling" | "grammar" | "style";
};

export const MAX_CHECK_LENGTH = 20_000;

type ApiMatch = {
  offset: number;
  length: number;
  message: string;
  replacements: { value: string }[];
  rule: { issueType: string; category: { id: string } };
};

export async function checkGrammar(text: string): Promise<GrammarIssue[]> {
  const body = new URLSearchParams({
    text,
    // British spelling, as used in India and most of the Commonwealth.
    language: "en-GB",
    // "picky" adds style suggestions (wordiness, repetition, weak phrasing)
    // on top of plain mistakes, which is the "make the sentence better" half.
    level: "picky",
  });
  const res = await fetch("https://api.languagetool.org/v2/check", { method: "POST", body });
  if (res.status === 429) throw new Error("Too many checks in a minute. Wait a moment and try again.");
  if (!res.ok) throw new Error(`The grammar checker returned ${res.status}.`);
  const data = (await res.json()) as { matches: ApiMatch[] };

  return data.matches.map((m) => ({
    offset: m.offset,
    length: m.length,
    message: m.message,
    replacements: m.replacements.slice(0, 4).map((r) => r.value),
    kind:
      m.rule.issueType === "misspelling"
        ? "spelling"
        : m.rule.issueType === "style" || m.rule.category.id === "STYLE" || m.rule.category.id === "REDUNDANCY"
          ? "style"
          : "grammar",
  }));
}
