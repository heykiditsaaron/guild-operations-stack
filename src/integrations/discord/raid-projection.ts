import { createHash } from "node:crypto";
import { raidEventFactsIncludingCancelled, raidOccurrenceDestinations } from "../../activities/raid/application.js";
import { raidSignups, type RaidSignupView } from "../../activities/raid/participation-view.js";
import { pool } from "../../db.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { publishOperationalRecord } from "../../operational-inspection.js";
import { positionForSpec } from "../../wow-traits/registry.js";
import { discordApplicationEmojis, discordApplicationEmojiMarkup, discordChannelMessage, discordEditChannelMessage } from "./api.js";
import { discordIntegrationConfiguration } from "./configuration.js";

type Projection = { discord_channel_id: string; discord_message_id: string };
type EmojiLookup = Map<string, string>;

function emojiName(className: string, specName: string): string {
  const part = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `go_spec_${part(className)}_${part(specName)}`;
}

function safeText(value: string): string {
  return value.replace(/@/g, "@\u200b").replace(/\r/g, " ").trim();
}

function rosterFields(rows: RaidSignupView[], emojis: EmojiLookup): { name: string; value: string; inline: boolean }[] {
  const active = rows.filter((row) => row.withdrawnAtUnix === null && row.deniedAtUnix === null);
  const assignedActors = new Set(active.filter((row) => row.assignmentId !== null).map((row) => `${row.actorKind}:${row.actorReference}`));
  const groups: Record<string, string[]> = {
    "Tank": [], "Healer": [], "Melee Damage": [], "Ranged Damage": [], "Damage": [], "Pending signups": [],
  };
  for (const row of active) {
    const name = safeText(row.displayName).slice(0, 90);
    if (row.assignmentId && row.selectedClass && row.selectedSpec && row.selectedRole) {
      const spec = `${row.selectedSpec} ${row.selectedClass}`;
      const icon = emojis.get(emojiName(row.selectedClass, row.selectedSpec));
      const line = `${icon ? icon + " " : ""}**${name}** — ${safeText(spec)}`;
      const position = positionForSpec(row.selectedClass, row.selectedSpec);
      const group = row.selectedRole === "tank" ? "Tank" : row.selectedRole === "healer" ? "Healer" :
        position === "melee" ? "Melee Damage" : position === "ranged" ? "Ranged Damage" : "Damage";
      groups[group].push(line);
    } else if (!row.assignmentId && !assignedActors.has(`${row.actorKind}:${row.actorReference}`)) {
      const specs = row.offeredSpecs.map((spec) => {
        const icon = emojis.get(emojiName(spec.className, spec.specName));
        return `${icon ? icon + " " : ""}${safeText(spec.specName)} ${safeText(spec.className)}`;
      }).join(", ");
      groups["Pending signups"].push(`**${name}** — ${specs}`);
    }
  }
  return Object.entries(groups).filter(([, entries]) => entries.length).map(([name, entries]) => {
    const lines: string[] = [];
    let used = 0;
    for (const entry of entries) {
      const remaining = 1010 - used;
      if (remaining < 30) { lines.push("…more in Guild Operations"); break; }
      const clipped = entry.length > remaining ? entry.slice(0, remaining - 1) + "…" : entry;
      lines.push(clipped);
      used += clipped.length + 1;
    }
    return { name: `${name} (${entries.length})`, value: lines.join("\n") || "—", inline: false };
  });
}

async function projectRaid(raidId: string): Promise<void> {
  const config = await discordIntegrationConfiguration();
  if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId) return;
  const prior = await pool.query<Projection>(
    "SELECT discord_channel_id, discord_message_id FROM discord_raid_projections WHERE raid_id = $1", [raidId],
  );
  let existing: Projection | null = prior.rows[0] ?? null;
  // Destination changes affect future publications, not already-published messages.
  const channelId = existing?.discord_channel_id ?? config.raidChannelId;
  if (!channelId) return;
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid) return;
  const [rows, availableEmojis] = await Promise.all([
    raidSignups(raidId),
    discordApplicationEmojis(config.botToken, config.applicationId).catch(() => []),
  ]);
  const emojis: EmojiLookup = new Map(availableEmojis.map((emoji) => [emoji.name, discordApplicationEmojiMarkup(emoji)]));
  const destinations = raidOccurrenceDestinations(raidId);
  const publicUrl = await installationAbsoluteUrl(destinations.find((item) => item.kind === "public")!.href);
  const signupUrl = await installationAbsoluteUrl(destinations.find((item) => item.kind === "participate")!.href);
  const status = raid.cancelledAtUnix !== null ? "Cancelled" : raid.concludedAtUnix !== null ? "Concluded" : "Scheduled";
  const description = [
    raid.description ? safeText(raid.description).slice(0, 1600) : null,
    `**Difficulty:** ${safeText(raid.difficulty)} · **Status:** ${status}`,
    `**Starts:** <t:${Math.floor(raid.occursAt[0])}:F> (<t:${Math.floor(raid.occursAt[0])}:R>)`,
    raid.occursAt[1] !== undefined ? `**Ends:** <t:${Math.floor(raid.occursAt[1])}:F>` : null,
    ...raid.requirements.slice(0, 8).map((requirement) => `**${safeText(requirement.label)}:** ${safeText(requirement.value)}`),
  ].filter(Boolean).join("\n").slice(0, 4096);
  const fields = rosterFields(rows, emojis);
  if (!fields.length) fields.push({ name: "Roster", value: "No active signups yet.", inline: false });
  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: safeText(raid.label).slice(0, 256),
      url: publicUrl,
      description,
      fields,
      color: raid.cancelledAtUnix !== null ? 0xb84040 : raid.concludedAtUnix !== null ? 0x667788 : 0x3275a8,
      footer: { text: "Guild Operations · Raid" },
    }],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: "View raid and sign up", url: signupUrl }] }],
  };
  if (existing) {
    try {
      await discordEditChannelMessage(config.botToken, channelId, existing.discord_message_id, payload);
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "discord_api_404") throw error;
      await pool.query("DELETE FROM discord_raid_projections WHERE raid_id = $1", [raidId]);
      existing = null;
    }
  }
  if (!existing) {
    const message = await discordChannelMessage(config.botToken, channelId, {
      ...payload,
      nonce: createHash("sha256").update(`${channelId}:${raidId}`).digest("hex").slice(0, 24),
      enforce_nonce: true,
    });
    await pool.query(
      `INSERT INTO discord_raid_projections (raid_id, discord_channel_id, discord_message_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (raid_id) DO UPDATE SET
         discord_channel_id = EXCLUDED.discord_channel_id,
         discord_message_id = EXCLUDED.discord_message_id,
         updated_at = now()`,
      [raidId, channelId, message.id],
    );
  }
}

export function registerDiscordRaidEmissionConsumer(): void {
  registerEmissionConsumer({
    consumerId: "discord.raid-projection",
    codes: [
      "raid.established", "raid.modified", "raid.cancelled", "raid.concluded",
      "raid.signup.established", "raid.signup.revoked", "raid.signup.denied",
      "raid.assignment.established", "raid.assignment.modified", "raid.assignment.withdrawn",
    ],
    receive: async (emission) => {
      try {
        await projectRaid(emission.subject);
        await publishOperationalRecord({
          source: "discord.raid-publication", operation: emission.code, kind: "result", result: "success",
          summary: `Discord raid projection reconciled: ${emission.code}`,
          details: { raidId: emission.subject },
        });
      } catch (error) {
        await publishOperationalRecord({
          source: "discord.raid-publication", operation: emission.code, kind: "exception",
          summary: "Discord raid projection failed",
          details: { raidId: emission.subject, error: error instanceof Error ? error.message : String(error) },
        }).catch(() => {});
        throw error;
      }
    },
  });
}
