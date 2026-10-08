/**
 * Render a short Discord-native teaser, not a second copy of the article.
 * Preserve paragraph boundaries and safe inline emphasis while dropping
 * document-only structure such as headings, rules and fenced code.
 */
export function discordArticleExcerpt(source: string, maxLength = 360): string {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];
  let inCode = false;
  const flush = () => {
    if (current.length) paragraphs.push(current.join(" ").trim());
    current = [];
  };
  for (const original of lines) {
    const line = original.trim();
    if (/^```/.test(line)) { flush(); inCode = !inCode; continue; }
    if (inCode) continue;
    if (!line || /^(-{3,}|_{3,}|\*{3,})$/.test(line)) { flush(); continue; }
    // Headings divide sections; the article title is already the embed title.
    if (/^#{1,6}\s+/.test(line)) { flush(); continue; }
    const cleaned = line
      .replace(/^-#\s+/, "")
      .replace(/^>\s?/, "")
      .replace(/^[-+*]\s+/, "• ")
      .replace(/^\d+[.)]\s+/, "• ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/__(.+?)__/g, "**$1")
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, "*$1")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    current.push(cleaned);
  }
  flush();
  const text = paragraphs.join("\n\n").trim();
  if (text.length <= maxLength) return text;
  const prefix = text.slice(0, maxLength - 1);
  const lastSpace = Math.max(prefix.lastIndexOf(" "), prefix.lastIndexOf("\n"));
  const cut = lastSpace > maxLength * 0.65 ? prefix.slice(0, lastSpace) : prefix;
  // Avoid leaving unclosed emphasis delimiters at the truncated boundary.
  return cut.trimEnd().replace(/[\s*_]+$/, "") + "…";
}
