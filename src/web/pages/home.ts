import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { installationOperational } from "../../core/installation/guild-binding.js";
import { guildHomepage, type GuildHomepagePrimitive } from "../../core/presentation/guild-homepage.js";
import { recentPublishedGuildArticles } from "../../core/articles/guild-articles.js";
import { identityPresentation } from "../../core/identity/identity-presentation.js";
import { ARTICLE_PUBLISH_CAPABILITY, identityHasGuildCapability } from "../../core/authority/guild-permissions.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { articlePreviewText } from "./article-markup.js";
import { viewerForRequest } from "../viewer.js";

async function renderPrimitive(primitive: GuildHomepagePrimitive, index: number, canPublishArticles: boolean): Promise<string> {
  if (primitive.kind === "articles") {
    const articles = await recentPublishedGuildArticles(primitive.count);
    if (articles.length === 0) return "";
    const items = await Promise.all(articles.map(async (article) => {
      const author = await identityPresentation(article.authorIdentityId);
      const published = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(article.publishedAtUnix! * 1000));
      const href = `/articles/${htmlText(article.articleId)}`;
      return `<a class="home-article-stub" href="${href}"><h3>${htmlText(article.title)}</h3><p class="home-article-preview">${htmlText(articlePreviewText(article.body))}</p><p class="home-article-meta">By ${htmlText(author.label)} · ${htmlText(published)}</p></a>`;
    }));
    return `<section class="home-articles" aria-labelledby="home-piece-${index}"><p class="home-section-kicker">From the guild</p><div class="home-articles-heading"><h2 id="home-piece-${index}">Latest Articles</h2><div class="home-articles-actions">${canPublishArticles ? '<a href="/articles/new">Create new</a>' : ""}<a href="/articles">All Articles →</a></div></div><div class="home-article-list">${items.join("")}</div></section>`;
  }
  if (primitive.kind === "card") {
    const texts = primitive.texts.map((text) => `<p>${htmlText(text)}</p>`).join("");
    return `<article class="home-card"><h2>${htmlText(primitive.heading)}</h2><div class="home-card-texts">${texts}</div></article>`;
  }

  const kicker = primitive.kicker ? `<p class="home-section-kicker">${htmlText(primitive.kicker)}</p>` : "";
  const heading = primitive.heading ? `<h2 id="home-piece-${index}">${htmlText(primitive.heading)}</h2>` : "";
  const labelledBy = primitive.heading ? ` aria-labelledby="home-piece-${index}"` : "";
  return `<section class="home-statement"${labelledBy}>${kicker}${heading}<p>${htmlText(primitive.body)}</p></section>`;
}

export async function registerHomePage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/", async (request, reply) => {
    if (!(await installationOperational())) return reply.redirect("/setup");

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, homepage, identity] = await Promise.all([
      viewerForRequest(sessionToken),
      guildHomepage(),
      authenticatedIdentity(sessionToken),
    ]);
    const canPublishArticles = identity ? await identityHasGuildCapability(identity.identityId, ARTICLE_PUBLISH_CAPABILITY) : false;

    const defaultLede = `A World of Warcraft guild.`;
    const lede = homepage.lede ?? defaultLede;
    const supportingText = homepage.supportingText
      ? `<p class="home-community-note">${htmlText(homepage.supportingText)}</p>`
      : "";
    const primitives = (await Promise.all(homepage.primitives.map((primitive, index) => renderPrimitive(primitive, index, canPublishArticles)))).join("\n");
    const editHomepage = viewer.authenticated && viewer.canConfigureGuildPresentation
      ? `<div class="home-edit"><a href="/admin/appearance">Edit homepage</a></div>`
      : "";

    const html = renderPage(assets, {
      pathname: "/",
      title: viewer.guildPresentation.guildName,
      description: `${viewer.guildPresentation.guildName} — ${lede}`,
      viewer,
      stylesheets: ["home.css"],
      header: `
        ${editHomepage}
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
