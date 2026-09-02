import { config } from "../config.js";
import { assetUrl, type AssetRegistry } from "./assets.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type RenderPageInput = {
  pathname: string;
  title: string;
  description?: string;
  body: string;
};

export function renderPage(assets: AssetRegistry, input: RenderPageInput): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description ?? "OH CRIT I Pulled! Guild Operations");
  const canonicalUrl = new URL(input.pathname, config.appOrigin).toString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="stylesheet" href="${assetUrl(assets, "app.css")}">
  <title>${title}</title>
</head>
<body>
${input.body}
  <script src="${assetUrl(assets, "app.js")}" defer></script>
</body>
</html>`;
}

export function htmlText(value: string): string {
  return escapeHtml(value);
}
