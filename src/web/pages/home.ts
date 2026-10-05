import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../auth.js";
import { installationOperational } from "../../core/installation/guild-binding.js";
import { guildHomepage, type GuildHomepageSection } from "../../core/presentation/guild-homepage.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

function renderSection(section: GuildHomepageSection, index: number): string {
  const kicker = section.kicker ? `<p class="home-section-kicker">${htmlText(section.kicker)}</p>` : "";
  const heading = section.heading ? `<h2 id="home-section-${index}">${htmlText(section.heading)}</h2>` : "";
  const labelledBy = section.heading ? ` aria-labelledby="home-section-${index}"` : "";

  if (section.kind === "statement") {
    return `<section class="home-statement"${labelledBy}>${kicker}${heading}<p>${htmlText(section.body)}</p></section>`;
  }

  const intro = section.body ? `<p>${htmlText(section.body)}</p>` : "";
  const cards = section.cards
    .map((card) => `<article class="home-card"><h3>${htmlText(card.title)}</h3><p>${htmlText(card.body)}</p></article>`)
    .join("\n");
  return `<section class="home-section"${labelledBy}><div class="home-section-heading">${kicker}${heading}${intro}</div><div class="home-card-group home-card-group-${section.layout}">${cards}</div></section>`;
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
    const sections = homepage.sections.map(renderSection).join("\n");

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
      body: `<div class="home-community">${sections}</div>`,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
