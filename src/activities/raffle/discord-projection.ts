import { createHash } from "node:crypto";
import { getRaffle, raffleParticipationCutoffUnix, raffleParticipationIsOpen } from "./application.js";
import { rafflePublicDestination } from "./destinations.js";
import { pool } from "../../db.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { discordChannelMessage, discordEditChannelMessage, discordStartMessageThread } from "../../integrations/discord/api.js";
import { discordIntegrationConfiguration } from "../../integrations/discord/configuration.js";

type Projection = { discord_channel_id: string; discord_message_id: string; discord_thread_id: string | null };
const safeText = (value: string): string => value.replace(/@/g, "@\u200b").replace(/\r/g, " ").trim();

async function ensureLedgerThread(
  raffleId: string, botToken: string, channelId: string, projection: Projection,
): Promise<void> {
  if (projection.discord_thread_id) return;
  const thread = await discordStartMessageThread(botToken, channelId, projection.discord_message_id, "Raffle claims");
  await pool.query(
    `UPDATE discord_raffle_projections
        SET discord_thread_id = $2, updated_at = now()
      WHERE raffle_id = $1 AND discord_message_id = $3 AND discord_thread_id IS NULL`,
    [raffleId, thread.id, projection.discord_message_id],
  );
}

async function projectRaffle(raffleId: string): Promise<void> {
  const config = await discordIntegrationConfiguration();
  if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId) return;
  const previous = await pool.query<Projection>(
    "SELECT discord_channel_id, discord_message_id, discord_thread_id FROM discord_raffle_projections WHERE raffle_id = $1", [raffleId],
  );
  let existing: Projection | null = previous.rows[0] ?? null;
  const channelId = existing?.discord_channel_id ?? config.raffleChannelId;
  if (!channelId) return;
  const raffle = await getRaffle(raffleId);
  if (!raffle || raffle.openedAtUnix === null) return;
  const publicUrl = await installationAbsoluteUrl(rafflePublicDestination(raffleId));
  const cutoff = raffleParticipationCutoffUnix(raffle.drawingAtUnix);
  const status = raffle.conclusion !== null ? "Concluded" : raffleParticipationIsOpen(raffle) ? "Open" : "Paused or closed";
  const description = [
    raffle.prizeDescription ? safeText(raffle.prizeDescription).slice(0, 1200) : null,
    `**Prize:** ${safeText(raffle.prizeKind)}${raffle.winnerPercentage === null ? "" : ` · ${raffle.winnerPercentage}% to winner`}`,
    `**Tickets:** ${raffle.entryPriceGold} gold each`,
    `**Entry cutoff:** <t:${cutoff}:F>`,
    `**Draw:** <t:${raffle.drawingAtUnix}:F>`,
    `**Status:** ${status}`,
  ].filter(Boolean).join("\n");
  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: safeText(raffle.title || "Guild Raffle").slice(0, 256),
      url: publicUrl,
      description,
      color: raffle.conclusion !== null ? 0x808080 : 0xa67cff,
      footer: { text: "Guild Operations · Raffle" },
    }],
    components: raffleParticipationIsOpen(raffle) ? [{ type: 1, components: [
      { type: 2, style: 1, label: "Enter Raffle", custom_id: `go:raffle:enter:${raffleId}` },
      { type: 2, style: 5, label: "View raffle", url: publicUrl },
    ] }] : [],
  };
  if (existing) {
    try {
      await discordEditChannelMessage(config.botToken, channelId, existing.discord_message_id, payload);
      await ensureLedgerThread(raffleId, config.botToken, channelId, existing);
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "discord_api_404") throw error;
      await pool.query("DELETE FROM discord_raffle_projections WHERE raffle_id = $1", [raffleId]);
      existing = null;
    }
  }
  if (!existing) {
    const message = await discordChannelMessage(config.botToken, channelId, {
      ...payload,
      nonce: createHash("sha256").update(`${channelId}:${raffleId}`).digest("hex").slice(0, 24),
      enforce_nonce: true,
    });
    await pool.query(
      `INSERT INTO discord_raffle_projections (raffle_id, discord_channel_id, discord_message_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (raffle_id) DO UPDATE SET
         discord_channel_id = EXCLUDED.discord_channel_id,
         discord_message_id = EXCLUDED.discord_message_id,
         updated_at = now()`,
      [raffleId, channelId, message.id],
    );
    await ensureLedgerThread(raffleId, config.botToken, channelId, { discord_channel_id: channelId, discord_message_id: message.id, discord_thread_id: null });
  }
}

export function registerDiscordRaffleEmissionConsumer(): void {
  registerEmissionConsumer({
    consumerId: "discord.raffle-projection",
    codes: [
      "raffle.established", "raffle.modified", "raffle.opened", "raffle.paused",
      "raffle.resumed", "raffle.cancelled", "raffle.concluded",
    ],
    receive: async (emission) => { await projectRaffle(emission.subject); },
  });
}
