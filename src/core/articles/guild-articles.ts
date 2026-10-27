import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db.js";
import { publishEmission, deliverEmission, type EmissionPublication } from "../../emissions/registry.js";
import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { ARTICLE_PUBLISH_CAPABILITY, ARTICLE_REMOVE_CAPABILITY, identityHasGuildCapability, requireGuildCapability } from "../authority/guild-permissions.js";

export type GuildArticle = Readonly<{
  articleId: string;
  guildId: string;
  authorIdentityId: string;
  title: string;
  body: string;
  createdAtUnix: number;
  updatedAtUnix: number;
  publishedAtUnix: number | null;
}>;

type ArticleRow = {
  article_id: string;
  guild_id: string;
  author_identity_id: string;
  title: string;
  body: string;
  created_at_unix: string | number;
  updated_at_unix: string | number;
  published_at_unix: string | number | null;
};

function articleFromRow(row: ArticleRow): GuildArticle {
  return {
    articleId: row.article_id,
    guildId: row.guild_id,
    authorIdentityId: row.author_identity_id,
    title: row.title,
    body: row.body,
    createdAtUnix: Number(row.created_at_unix),
    updatedAtUnix: Number(row.updated_at_unix),
    publishedAtUnix: row.published_at_unix === null ? null : Number(row.published_at_unix),
  };
}

function authoredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Article ${field} must not be empty`);
  return normalized;
}

async function articleForUpdate(client: PoolClient, articleId: string, guildId: string): Promise<GuildArticle | null> {
  const result = await client.query<ArticleRow>(
    `SELECT article_id, guild_id, author_identity_id, title, body,
            created_at_unix, updated_at_unix, published_at_unix
       FROM guild_articles
      WHERE article_id = $1 AND guild_id = $2
      FOR UPDATE`,
    [articleId, guildId],
  );
  return result.rows[0] ? articleFromRow(result.rows[0]) : null;
}

function requireCreator(article: GuildArticle, actorIdentityId: string): void {
  if (article.authorIdentityId !== actorIdentityId) throw new Error("Only the Article creator may modify or publish it");
}

async function deliverAfterCommit(publication: EmissionPublication | null): Promise<void> {
  if (publication) await deliverEmission(publication);
}

export async function createGuildArticle(actorIdentityId: string, input: { title: string; body: string }): Promise<GuildArticle> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  await requireGuildCapability(actorIdentityId, ARTICLE_PUBLISH_CAPABILITY, guildId);
  const title = authoredText(input.title, "title");
  const body = authoredText(input.body, "body");
  const result = await pool.query<ArticleRow>(
    `INSERT INTO guild_articles (guild_id, author_identity_id, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING article_id, guild_id, author_identity_id, title, body,
               created_at_unix, updated_at_unix, published_at_unix`,
    [guildId, actorIdentityId, title, body],
  );
  return articleFromRow(result.rows[0]);
}

export async function updateGuildArticle(actorIdentityId: string, articleId: string, input: { title: string; body: string }): Promise<GuildArticle> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  await requireGuildCapability(actorIdentityId, ARTICLE_PUBLISH_CAPABILITY, guildId);
  const title = authoredText(input.title, "title");
  const body = authoredText(input.body, "body");
  let publication: EmissionPublication | null = null;
  const article = await withTransaction(async (client) => {
    const existing = await articleForUpdate(client, articleId, guildId);
    if (!existing) throw new Error("Article not found");
    requireCreator(existing, actorIdentityId);
    const result = await client.query<ArticleRow>(
      `UPDATE guild_articles
          SET title = $3, body = $4, updated_at_unix = extract(epoch FROM now())::bigint
        WHERE article_id = $1 AND guild_id = $2
        RETURNING article_id, guild_id, author_identity_id, title, body,
                  created_at_unix, updated_at_unix, published_at_unix`,
      [articleId, guildId, title, body],
    );
    const updated = articleFromRow(result.rows[0]);
    if (updated.publishedAtUnix !== null) publication = await publishEmission(client, { code: "article.modified", subject: articleId });
    return updated;
  });
  await deliverAfterCommit(publication);
  return article;
}

export async function publishGuildArticle(actorIdentityId: string, articleId: string): Promise<GuildArticle> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  await requireGuildCapability(actorIdentityId, ARTICLE_PUBLISH_CAPABILITY, guildId);
  let publication: EmissionPublication | null = null;
  const article = await withTransaction(async (client) => {
    const existing = await articleForUpdate(client, articleId, guildId);
    if (!existing) throw new Error("Article not found");
    requireCreator(existing, actorIdentityId);
    if (existing.publishedAtUnix !== null) return existing;
    const result = await client.query<ArticleRow>(
      `UPDATE guild_articles
          SET published_at_unix = extract(epoch FROM now())::bigint,
              updated_at_unix = extract(epoch FROM now())::bigint
        WHERE article_id = $1 AND guild_id = $2
        RETURNING article_id, guild_id, author_identity_id, title, body,
                  created_at_unix, updated_at_unix, published_at_unix`,
      [articleId, guildId],
    );
    publication = await publishEmission(client, { code: "article.published", subject: articleId });
    return articleFromRow(result.rows[0]);
  });
  await deliverAfterCommit(publication);
  return article;
}

export async function removeGuildArticle(actorIdentityId: string, articleId: string): Promise<void> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const publication = await withTransaction(async (client) => {
    const existing = await articleForUpdate(client, articleId, guildId);
    if (!existing) throw new Error("Article not found");
    const creator = existing.authorIdentityId === actorIdentityId;
    if (creator) {
      await requireGuildCapability(actorIdentityId, ARTICLE_PUBLISH_CAPABILITY, guildId);
    } else if (!await identityHasGuildCapability(actorIdentityId, ARTICLE_REMOVE_CAPABILITY, guildId)) {
      throw new Error("Identity cannot remove another author's Article");
    }
    await client.query("DELETE FROM guild_articles WHERE article_id = $1 AND guild_id = $2", [articleId, guildId]);
    return existing.publishedAtUnix === null ? null : publishEmission(client, { code: "article.removed", parent: guildId, subject: articleId });
  });
  await deliverAfterCommit(publication);
}

export async function publishedGuildArticle(articleId: string): Promise<GuildArticle | null> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<ArticleRow>(
    `SELECT article_id, guild_id, author_identity_id, title, body,
            created_at_unix, updated_at_unix, published_at_unix
       FROM guild_articles
      WHERE article_id = $1 AND guild_id = $2 AND published_at_unix IS NOT NULL`,
    [articleId, guildId],
  );
  return result.rows[0] ? articleFromRow(result.rows[0]) : null;
}

export async function recentPublishedGuildArticles(limit = 20): Promise<GuildArticle[]> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const result = await pool.query<ArticleRow>(
    `SELECT article_id, guild_id, author_identity_id, title, body,
            created_at_unix, updated_at_unix, published_at_unix
       FROM guild_articles
      WHERE guild_id = $1 AND published_at_unix IS NOT NULL
      ORDER BY published_at_unix DESC, article_id DESC
      LIMIT $2`,
    [guildId, boundedLimit],
  );
  return result.rows.map(articleFromRow);
}

export async function guildArticlesForAuthor(actorIdentityId: string): Promise<GuildArticle[]> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  await requireGuildCapability(actorIdentityId, ARTICLE_PUBLISH_CAPABILITY, guildId);
  const result = await pool.query<ArticleRow>(
    `SELECT article_id, guild_id, author_identity_id, title, body,
            created_at_unix, updated_at_unix, published_at_unix
       FROM guild_articles
      WHERE guild_id = $1 AND author_identity_id = $2
      ORDER BY updated_at_unix DESC, article_id DESC`,
    [guildId, actorIdentityId],
  );
  return result.rows.map(articleFromRow);
}
