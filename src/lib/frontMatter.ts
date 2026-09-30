export function stripFrontMatter(raw: string): { title: string; body: string } {
  // The chapter files may carry Windows (CRLF) line endings.
  const match = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { title: "", body: raw };

  const [, frontMatter, body] = match;
  const titleMatch = frontMatter.match(/^title:\s*(.+)$/m);
  return { title: titleMatch?.[1]?.trim() ?? "", body: body.trim() };
}
