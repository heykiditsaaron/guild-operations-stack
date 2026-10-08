import { pool } from "../../db.js";
import { publishedGuildArticle } from "../../core/articles/guild-articles.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { publishOperationalRecord } from "../../operational-inspection.js";
import { articlePreviewText } from "../../web/pages/article-markup.js";
import { discordIntegrationConfiguration } from "./configuration.js";
import { discordChannelMessage, discordDeleteChannelMessage, discordEditChannelMessage } from "./api.js";

type Projection = { discord_channel_id: string; discord_message_id: string };

async function existingProjection(articleId: string): Promise<Projection | null> {
  const result = await pool.query<Projection>(
    "SELECT discord_channel_id, discord_message_id FROM discord_article_projections WHERE article_id = $1",
    [articleId],
  );
  return result.rows[0] ?? null;
}

async function removeProjection(articleId: string, botToken: string, existing: Projection): Promise<void> {
  await discordDeleteChannelMessage(botToken, existing.discord_channel_id, existing.discord_message_id);
  await pool.query(
    "DELETE FROM discord_article_projections WHERE article_id = $1 AND discord_channel_id = $2 AND discord_message_id = $3",
    [articleId, existing.discord_channel_id, existing.discord_message_id],
  );
}

async function projectArticle(code: string, articleId: string): Promise<void> {
  const config = await discordIntegrationConfiguration();
  if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId) return;

  let existing = await existingProjection(articleId);
  const article = code === "article.removed" ? null : await publishedGuildArticle(articleId);
  const channelId = article ? config.articleChannelId : null;

  if (existing && (!channelId || existing.discord_channel_id !== channelId)) {
    await removeProjection(articleId, config.botToken, existing);
    existing = null;
  }
  if (!article || !channelId) return;

  const url = await installationAbsoluteUrl(`/articles/${encodeURIComponent(articleId)}`);
  const excerpt = articlePreviewText(article.body, 1200);
  const payload = {
    allowed_mentions: { parse: [] },
    // Discord deduplicates a repeated create with this nonce during its short retry window.
    nonce: `go-article-${articleId}`,
    enforce_nonce: true,
    embeds: [{
      title: article.title.slice(0, 256),
      url,
      description: excerpt || "Read the full article in Guild Operations.",
      footer: { text: "Guild Operations · Article" },
    }],
    components: [{
      type: 1,
      components: [{ type: 2, style: 5, label: "Read full article", url }],
    }],
  };

  if (existing) {
    try {
      await discordEditChannelMessage(config.botToken, channelId, existing.discord_message_id, payload);
    } catch (error) {
      // An externally deleted message may be recreated; other failures remain retryable.
      if (!(error instanceof Error) || error.message !== "discord_api_404") throw error;
      await pool.query("DELETE FROM discord_article_projections WHERE article_id = $1", [articleId]);
      existing = null;
    }
  }
  if (!existing) {
    const message = await discordChannelMessage(config.botToken, channelId, payload);
    await pool.query(
      `INSERT INTO discord_article_projections (article_id, discord_channel_id, discord_message_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (article_id) DO UPDATE SET
         discord_channel_id = EXCLUDED.discord_channel_id,
         discord_message_id = EXCLUDED.discord_message_id,
         updated_at = now()`,
      [articleId, channelId, message.id],
    );
  }
}

export function registerDiscordArticleEmissionConsumer(): void {
  registerEmissionConsumer({
    consumerId: "discord.article-projection",
    codes: ["article.published", "article.modified", "article.removed"],
    receive: async (emission) => {
      try {
        await projectArticle(emission.code, emission.subject);
        await publishOperationalRecord({
          source: "discord.article-publication",
          operation: emission.code,
          kind: "result",
          result: "success",
          summary: `Discord article projection reconciled: ${emission.code}`,
          details: { articleId: emission.subject },
        });
      } catch (error) {
        await publishOperationalRecord({
          source: "discord.article-publication",
          operation: emission.code,
          kind: "exception",
          summary: "Discord article projection failed",
          details: { articleId: emission.subject, error: error instanceof Error ? error.message : String(error) },
        }).catch(() => {});
        throw error;
      }
    },
  });
}
