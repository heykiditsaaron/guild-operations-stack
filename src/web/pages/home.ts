import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { installationOperational } from "../../core/installation/guild-binding.js";
import { guildHomepage, type GuildHomepagePrimitive } from "../../core/presentation/guild-homepage.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function renderPrimitive(primitive: GuildHomepagePrimitive, index: number): string {
  const widthClass = `home-piece-${primitive.width}`;
  if (primitive.kind === "card") {
    return `<article class="home-card home-piece ${widthClass}"><h2>${htmlText(primitive.heading)}</h2><p>${htmlText(primitive.body)}</p></article>`;
  }

  const kicker = primitive.kicker ? `<p class="home-section-kicker">${htmlText(primitive.kicker)}</p>` : "";
  const heading = primitive.heading ? `<h2 id="home-piece-${index}">${htmlText(primitive.heading)}</h2>` : "";
  const labelledBy = primitive.heading ? ` aria-labelledby="home-piece-${index}"` : "";
  return `<section class="home-statement home-piece ${widthClass}"${labelledBy}>${kicker}${heading}<p>${htmlText(primitive.body)}</p></section>`;
}

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (request, reply) => {
    if (!(await installationOperational())) return reply.redirect("/setup");

    const [viewer, homepage] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      guildHomepage(),
    ]);

    const defaultLede = `A World of Warcraft guild.`;
    const lede = homepage.lede ?? defaultLede;
    const supportingText = homepage.supportingText
      ? `<p class="home-community-note">${htmlText(homepage.supportingText)}</p>`
      : "";
    const primitives = homepage.primitives.map(renderPrimitive).join("\n");

    const html = renderPage(assets, {
      pathname: "/",
      title: viewer.guildPresentation.guildName,
      description: `${viewer.guildPresentation.guildName} — ${lede}`,
      viewer,
      stylesheets: ["home.css"],
      header: `
        <div class="home-community-header">
          <p class="home-community-mark">World of Warcraft guild</p>
          <h1 id="page-title">${htmlText(viewer.guildPresentation.guildName)}</h1>
          <p class="home-community-lede">${htmlText(lede)}</p>
          ${supportingText}
        </div>`,
      body: `<div class="home-community">${primitives}</div>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
