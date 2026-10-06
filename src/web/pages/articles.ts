import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { ARTICLE_PUBLISH_CAPABILITY, identityHasGuildCapability } from "../../core/authority/guild-permissions.js";
import { createGuildArticle, guildArticlesForAuthor, publishedGuildArticle, publishGuildArticle, recentPublishedGuildArticles, updateGuildArticle, type GuildArticle } from "../../core/articles/guild-articles.js";
import { identityPresentation } from "../../core/identity/identity-presentation.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";
import { renderArticleBody } from "./article-markup.js";

function date(unix: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(unix * 1000));
}

async function articleCard(article: GuildArticle): Promise<string> {
  const author = await identityPresentation(article.authorIdentityId);
  return `<article class="article-list-card"><p class="eyebrow">Guild Article</p><h2><a href="/articles/${htmlText(article.articleId)}">${htmlText(article.title)}</a></h2><p class="article-meta">By ${htmlText(author.label)} · ${date(article.publishedAtUnix!)}</p></article>`;
}

function authoringForm(article?: GuildArticle): string {
  const action = article ? `/articles/${article.articleId}/edit` : "/articles/new";
  return `<form method="post" action="${action}" class="article-authoring">
    <label><span>Title</span><input name="title" maxlength="200" required value="${htmlText(article?.title ?? "")}"></label>
    <label><span>Article</span><textarea name="body" required>${htmlText(article?.body ?? "")}</textarea></label>
    <p class="article-meta">Formatting supports headings, bold, italic, strikethrough, subtext (-#), lists, blockquotes, links, inline code, fenced code blocks, and horizontal rules.</p>
    <div class="article-authoring-actions"><button type="submit" class="button-primary">Save ${article ? "changes" : "draft"}</button>${article && article.publishedAtUnix === null ? `<button type="submit" formaction="/articles/${article.articleId}/publish" class="button-secondary">Publish</button>` : ""}<button type="submit" formaction="/articles/preview" formtarget="_blank" class="button-secondary">Preview</button></div>
  </form>`;
}

export async function registerArticlesPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
      const params = new URLSearchParams(typeof body === "string" ? body : body.toString("utf8"));
      done(null, Object.fromEntries(params.entries()));
    });
  }

  app.get("/articles", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, identity, articles] = await Promise.all([viewerForRequest(token), authenticatedIdentity(token), recentPublishedGuildArticles(50)]);
    const canPublish = identity ? await identityHasGuildCapability(identity.identityId, ARTICLE_PUBLISH_CAPABILITY) : false;
    const drafts = canPublish && identity ? (await guildArticlesForAuthor(identity.identityId)).filter((article) => article.publishedAtUnix === null) : [];
    const cards = await Promise.all(articles.map(articleCard));
    const draftCards = drafts.map((article) => `<article class="article-list-card"><p class="eyebrow">Draft</p><h2><a href="/articles/${article.articleId}/edit">${htmlText(article.title)}</a></h2><p class="article-meta">Last saved ${date(article.updatedAtUnix)}</p></article>`).join("");
    const body = `${cards.length ? `<div class="article-list">${cards.join("")}</div>` : "<p>No Articles have been published yet.</p>"}${draftCards ? `<section class="article-drafts"><h2>Your drafts</h2><div class="article-list">${draftCards}</div></section>` : ""}`;
    return reply.header("Cache-Control","no-cache").type("text/html; charset=utf-8").send(renderPage(assets,{pathname:"/articles",title:`Articles · ${viewer.guildPresentation.guildName} Guild Operations`,viewer,header:`<div class="article-listing-header"><div><p class="eyebrow">Guild communication</p><h1 id="page-title">Articles</h1><p class="lede">News, information, and updates from the guild.</p></div>${canPublish ? '<a class="button-primary" href="/articles/new">Create new</a>' : ""}</div>`,body}));
  });

  app.get("/articles/new", async (request, reply) => {
    const token=request.cookies[SESSION_COOKIE_NAME]; const [viewer,identity]=await Promise.all([viewerForRequest(token),authenticatedIdentity(token)]);
    if (!identity) return reply.redirect("/auth/blizzard/start?return_to=%2Farticles%2Fnew");
    if (!await identityHasGuildCapability(identity.identityId,ARTICLE_PUBLISH_CAPABILITY)) return reply.code(403).send("Article publishing authority is required.");
    return reply.type("text/html; charset=utf-8").send(renderPage(assets,{pathname:"/articles/new",title:`New Article · ${viewer.guildPresentation.guildName}`,viewer,secondaryNavigation:{kind:"back",label:"Articles",href:"/articles"},header:'<div><p class="eyebrow">Guild Article</p><h1 id="page-title">Create Article</h1><p class="lede">Write now; publish when it is ready for the guild.</p></div>',body:authoringForm()}));
  });

  app.post("/articles/new", async (request, reply) => {
    const identity=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]); if(!identity) return reply.code(401).send("Authentication is required.");
    const body=request.body as {title?:unknown;body?:unknown}; if(typeof body.title!=="string"||typeof body.body!=="string") return reply.code(400).send("Title and Article body are required.");
    const article=await createGuildArticle(identity.identityId,{title:body.title,body:body.body}); return reply.redirect(`/articles/${article.articleId}/edit`);
  });

  app.post("/articles/preview", async (request, reply) => {
    const token=request.cookies[SESSION_COOKIE_NAME]; const [viewer,identity]=await Promise.all([viewerForRequest(token),authenticatedIdentity(token)]);
    if(!identity) return reply.code(401).send("Authentication is required.");
    if(!await identityHasGuildCapability(identity.identityId,ARTICLE_PUBLISH_CAPABILITY)) return reply.code(403).send("Article publishing authority is required.");
    const body=request.body as {title?:unknown;body?:unknown}; if(typeof body.title!=="string"||typeof body.body!=="string"||!body.title.trim()||!body.body.trim()) return reply.code(400).send("Title and Article body are required.");
    const author=await identityPresentation(identity.identityId);
    return reply.header("Cache-Control","no-store").type("text/html; charset=utf-8").send(renderPage(assets,{pathname:"/articles/preview",title:\`Preview: \${body.title.trim()} · \${viewer.guildPresentation.guildName}\`,viewer,secondaryNavigation:{kind:"back",label:"Close preview",href:"/articles"},header:\`<article class="article-document-header"><p class="eyebrow">Article Preview</p><h1 id="page-title">\${htmlText(body.title.trim())}</h1><p class="article-meta">By \${htmlText(author.label)} · Not published</p></article>\`,body:\`<article class="article-document"><div class="article-body">\${renderArticleBody(body.body)}</div></article>\`}));
  });

  app.get("/articles/:articleId/edit", async (request, reply) => {
    const {articleId}=request.params as {articleId:string}; const token=request.cookies[SESSION_COOKIE_NAME]; const [viewer,identity]=await Promise.all([viewerForRequest(token),authenticatedIdentity(token)]);
    if(!identity) return reply.redirect(`/auth/blizzard/start?return_to=${encodeURIComponent(`/articles/${articleId}/edit`)}`);
    const own=(await guildArticlesForAuthor(identity.identityId)).find((article)=>article.articleId===articleId); if(!own) return reply.code(404).send("Article not found.");
    return reply.type("text/html; charset=utf-8").send(renderPage(assets,{pathname:`/articles/${articleId}/edit`,title:`Edit ${own.title} · ${viewer.guildPresentation.guildName}`,viewer,secondaryNavigation:{kind:"back",label:"Articles",href:"/articles"},header:`<div><p class="eyebrow">${own.publishedAtUnix===null?"Draft":"Published Article"}</p><h1 id="page-title">Edit Article</h1></div>`,body:authoringForm(own)}));
  });

  app.post("/articles/:articleId/edit", async (request, reply) => {
    const identity=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]); if(!identity) return reply.code(401).send("Authentication is required.");
    const {articleId}=request.params as {articleId:string}; const body=request.body as {title?:unknown;body?:unknown}; if(typeof body.title!=="string"||typeof body.body!=="string") return reply.code(400).send("Title and Article body are required.");
    const article=await updateGuildArticle(identity.identityId,articleId,{title:body.title,body:body.body}); return reply.redirect(article.publishedAtUnix===null?`/articles/${articleId}/edit`:`/articles/${articleId}`);
  });

  app.post("/articles/:articleId/publish", async (request, reply) => {
    const identity=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]); if(!identity) return reply.code(401).send("Authentication is required.");
    const {articleId}=request.params as {articleId:string}; const body=request.body as {title?:unknown;body?:unknown};
    if(typeof body.title==="string"&&typeof body.body==="string") await updateGuildArticle(identity.identityId,articleId,{title:body.title,body:body.body});
    await publishGuildArticle(identity.identityId,articleId); return reply.redirect(`/articles/${articleId}`);
  });

  app.get("/articles/:articleId", async (request, reply) => {
    const {articleId}=request.params as {articleId:string}; const token=request.cookies[SESSION_COOKIE_NAME]; const [viewer,identity,article]=await Promise.all([viewerForRequest(token),authenticatedIdentity(token),publishedGuildArticle(articleId)]);
    if(!article) return reply.code(404).send("Article not found.");
    const [author,canEdit]=await Promise.all([identityPresentation(article.authorIdentityId),Promise.resolve(identity?.identityId===article.authorIdentityId)]);
    return reply.header("Cache-Control","no-cache").type("text/html; charset=utf-8").send(renderPage(assets,{pathname:`/articles/${articleId}`,title:`${article.title} · ${viewer.guildPresentation.guildName}`,viewer,secondaryNavigation:{kind:"back",label:"Articles",href:"/articles"},header:`<article class="article-document-header"><p class="eyebrow">Guild Article</p><h1 id="page-title">${htmlText(article.title)}</h1><p class="article-meta">By ${htmlText(author.label)} · Published ${date(article.publishedAtUnix!)}${article.updatedAtUnix>article.publishedAtUnix!?` · Updated ${date(article.updatedAtUnix)}`:""}</p>${canEdit?`<p class="article-meta"><a href="/articles/${article.articleId}/edit">Edit</a></p>`:""}</article>`,body:`<article class="article-document"><div class="article-body">${renderArticleBody(article.body)}</div></article>`}));
  });
}
