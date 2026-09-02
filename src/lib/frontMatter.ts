export function stripFrontMatter(raw: string): { title: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { title: "", body: raw };

  const [, frontMatter, body] = match;
  const titleMatch = frontMatter.match(/^title:\s*(.+)$/m);
  return { title: titleMatch?.[1]?.trim() ?? "", body: body.trim() };
}
