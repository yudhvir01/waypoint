// Looks up an English word or phrase for the note editor's Define button.
// Single words go to the Free Dictionary API first (clean definitions,
// pronunciation audio); phrases, and words it doesn't know, go to
// Wiktionary, which covers idioms like "in lieu of". Only the selected
// text is sent, never the note.

export type Sense = { definition: string; example?: string };
export type Meaning = { partOfSpeech: string; senses: Sense[] };
export type Definition = {
  word: string;
  phonetic?: string;
  audio?: string;
  meanings: Meaning[];
  source: "Free Dictionary" | "Wiktionary";
};

const MAX_MEANINGS = 4;
const MAX_SENSES = 3;

// Selections often carry the punctuation around a word ("ubiquitous," or
// "(in lieu of)"), which neither source matches.
export function cleanTerm(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

// Long selections are sentences, not something to look up.
export function isLookupable(text: string): boolean {
  const term = cleanTerm(text);
  return term.length > 0 && term.length <= 60 && term.split(" ").length <= 6 && /\p{L}/u.test(term);
}

const cache = new Map<string, Definition | null>();

// null means neither source has it; a network failure throws.
export async function define(text: string): Promise<Definition | null> {
  const term = cleanTerm(text);
  const lower = term.toLowerCase();
  if (cache.has(lower)) return cache.get(lower)!;

  let result: Definition | null = null;
  // The Free Dictionary API has occasional outages; Wiktionary covers
  // words too, so a failure there just falls through to it.
  if (!lower.includes(" ")) result = await fromFreeDictionary(lower).catch(() => null);
  if (!result) result = await fromWiktionary(lower);
  // Wiktionary titles are case-sensitive, so "Python" and "python" differ.
  if (!result && term !== lower) result = await fromWiktionary(term);

  cache.set(lower, result);
  return result;
}

type FreeEntry = {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
};

async function fromFreeDictionary(term: string): Promise<Definition | null> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Dictionary returned ${res.status}`);
  const entries = (await res.json()) as FreeEntry[];
  if (!entries.length) return null;

  const phonetics = entries.flatMap((e) => e.phonetics ?? []);
  // The same part of speech can appear in several entries; merge them.
  const byPart = new Map<string, Sense[]>();
  for (const m of entries.flatMap((e) => e.meanings ?? [])) {
    const senses = byPart.get(m.partOfSpeech) ?? [];
    senses.push(...m.definitions.map((d) => ({ definition: d.definition, example: d.example })));
    byPart.set(m.partOfSpeech, senses);
  }
  const meanings = [...byPart]
    .slice(0, MAX_MEANINGS)
    .map(([partOfSpeech, senses]) => ({ partOfSpeech, senses: senses.slice(0, MAX_SENSES) }));
  if (!meanings.length) return null;

  return {
    word: entries[0].word,
    phonetic: entries[0].phonetic ?? phonetics.find((p) => p.text)?.text,
    audio: phonetics.find((p) => p.audio)?.audio || undefined,
    meanings,
    source: "Free Dictionary",
  };
}

type WiktionaryUsage = {
  partOfSpeech: string;
  definitions: { definition: string; examples?: string[] }[];
};

async function fromWiktionary(term: string): Promise<Definition | null> {
  const title = encodeURIComponent(term.replace(/ /g, "_"));
  const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${title}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wiktionary returned ${res.status}`);
  const data = (await res.json()) as { en?: WiktionaryUsage[] };

  const meanings = (data.en ?? [])
    .map((usage) => ({
      partOfSpeech: usage.partOfSpeech.toLowerCase(),
      senses: usage.definitions
        .map((d) => ({
          definition: htmlToText(d.definition),
          example: d.examples?.[0] ? htmlToText(d.examples[0]) : undefined,
        }))
        .filter((s) => s.definition)
        .slice(0, MAX_SENSES),
    }))
    .filter((m) => m.senses.length)
    .slice(0, MAX_MEANINGS);
  if (!meanings.length) return null;

  return { word: term, meanings, source: "Wiktionary" };
}

// Wiktionary definitions are HTML, with sub-senses nested as lists; keep
// just the top-level sentence as plain text.
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("ol, ul, dl").forEach((el) => el.remove());
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
