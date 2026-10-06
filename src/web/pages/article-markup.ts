import { htmlText } from "../render.js";

function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inlineMarkup(source: string): string {
  let value = htmlText(source);
  value = value.replace(/\`([^\`\n]+)\`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^\n*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/__([^\n_]+)__/g, "<strong>$1</strong>");
  value = value.replace(/~~([^\n~]+)~~/g, "<del>$1</del>");
  value = value.replace(/(?<!\*)\*([^\n*]+)\*(?!\*)/g, "<em>$1</em>");
  value = value.replace(/(?<!_)_([^\n_]+)_(?!_)/g, "<em>$1</em>");
  value = value.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const safe = safeHref(href.replaceAll("&amp;", "&"));
    return safe ? `<a href="${htmlText(safe)}"${safe.startsWith("/") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${label}</a>` : label;
  });
  return value;
}

export function renderArticleBody(source: string): string {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkup(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) output.push(`<blockquote><p>${inlineMarkup(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };
  const flushBlocks = () => { flushParagraph(); closeList(); flushQuote(); };

  for (const line of lines) {
    if (code !== null) {
      if (/^\s*\`\`\`/.test(line)) {
        output.push(`<pre><code>${htmlText(code.join("\n"))}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (/^\s*\`\`\`/.test(line)) { flushBlocks(); code = []; continue; }
    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { flushBlocks(); output.push("<hr>"); continue; }
    const subtext = /^-#\s+(.+)$/.exec(line);
    if (subtext) { flushBlocks(); output.push(`<p class="article-meta">${inlineMarkup(subtext[1])}</p>`); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { flushBlocks(); const level = heading[1].length; output.push(`<h${level}>${inlineMarkup(heading[2])}</h${level}>`); continue; }
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) { flushParagraph(); closeList(); quote.push(quoted[1]); continue; }
    if (quote.length) flushQuote();
    const unordered = /^\s*[-+*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const wanted = unordered ? "ul" : "ol";
      if (list !== wanted) { closeList(); list = wanted; output.push(`<${list}>`); }
      output.push(`<li>${inlineMarkup((unordered ?? ordered)![1])}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) { flushParagraph(); continue; }
    paragraph.push(line.trim());
  }
  flushBlocks();
  if (code !== null) output.push(`<pre><code>${htmlText(code.join("\n"))}</code></pre>`);
  return output.join("\n");
}


export function articlePreviewText(source: string, maxLength = 180): string {
  const plain = source
    .replace(/^s*```.*$/gm, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^-#\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`]([^\n]*?)[*_~`]/g, "$1")
    .replace(/^\s*(?:---+|___+|\*\*\*+)\s*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s+\S*$/, "").trimEnd() + "…";
}
