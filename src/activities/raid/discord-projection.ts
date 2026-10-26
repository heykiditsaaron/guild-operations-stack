import { belongsToActiveGuild } from "../../integrations/discord/projection-guild-boundary.js";
import { createHash } from "node:crypto";
import { componentLogger } from "../../core/runtime-logger.js";
import { publishInspectionBestEffort } from "../../core/operational-inspection/best-effort.js";
import { requireOperationalInstallationGuildBinding } from "../../core/installation/guild-binding.js";
import { raidEventFactsIncludingCancelled, raidOccurrenceDestinations } from "./application.js";
import { raidSignups, type RaidSignupView } from "./participation-view.js";
import { pool } from "../../db.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { publishOperationalRecord } from "../../operational-inspection.js";
import { positionForSpec } from "../../wow-traits/registry.js";
import { discordApplicationEmojis, discordApplicationEmojiMarkup, discordChannelMessage, discordEditChannelMessage } from "../../integrations/discord/api.js";
import { discordIntegrationConfiguration } from "../../integrations/discord/configuration.js";

const log = componentLogger("raid.discord-projection");

type Projection = { discord_channel_id: string; discord_message_id: string };
type EmojiLookup = Map<string, string>;

function emojiName(className: string, specName: string): string {
  const part = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `go_spec_${part(className)}_${part(specName)}`;
}

function safeText(value: string): string {
  return value.replace(/@/g, "@\u200b").replace(/\r/g, " ").trim();
}

function rosterFields(rows: RaidSignupView[], emojis: EmojiLookup, discordIds: Map<string, string>): { name: string; value: string; inline: boolean }[] {
  const active = rows.filter((row) => row.withdrawnAtUnix === null && row.deniedAtUnix === null);
  const assignedActors = new Set(active.filter((row) => row.assignmentId !== null).map((row) => `${row.actorKind}:${row.actorReference}`));
  const groups: Record<string, string[]> = {
    "Tanks": [], "Melee Damage": [], "Ranged Damage": [], "Healers": [], "Damage": [], "Pending signups": [],
  };
  for (const row of active) {
    const discordId = discordIds.get(`${row.actorKind}:${row.actorReference}`);
    const name = discordId ? `<@${discordId}>` : safeText(row.displayName).slice(0, 90);
    if (row.assignmentId && row.selectedClass && row.selectedSpec && row.selectedRole) {
      const spec = `${row.selectedSpec} ${row.selectedClass}`;
      const icon = emojis.get(emojiName(row.selectedClass, row.selectedSpec));
      const line = `${icon ? icon + " " : ""}**${name}**${icon ? "" : ` — ${safeText(spec)}`}`;
      const position = positionForSpec(row.selectedClass, row.selectedSpec);
      const group = row.selectedRole === "tank" ? "Tanks" : row.selectedRole === "healer" ? "Healers" :
        position === "melee" ? "Melee Damage" : position === "ranged" ? "Ranged Damage" : "Damage";
      groups[group].push(line);
    } else if (!row.assignmentId && !assignedActors.has(`${row.actorKind}:${row.actorReference}`)) {
      const specs = row.offeredSpecs.map((spec) => {
        const icon = emojis.get(emojiName(spec.className, spec.specName));
        return icon ?? `${safeText(spec.specName)} ${safeText(spec.className)}`;
      }).join(", ");
      groups["Pending signups"].push(`**${name}** — ${specs}`);
    }
  }
  const roleIcons: Record<string, string | undefined> = {
    "Tanks": emojis.get("go_raid_tank"),
    "Melee Damage": emojis.get("go_raid_damage"),
    "Ranged Damage": emojis.get("go_raid_damage"),
    "Healers": emojis.get("go_raid_healer"),
    "Damage": emojis.get("go_raid_damage"),
  };
  return Object.entries(groups).filter(([name, entries]) => name !== "Damage" || entries.length > 0).map(([name, entries]) => {
    const lines: string[] = [];
    let used = 0;
    for (const entry of entries) {
      const remaining = 1010 - used;
      if (remaining < 30) { lines.push("…more in Guild Operations"); break; }
      const clipped = entry.length > remaining ? entry.slice(0, remaining - 1) + "…" : entry;
      lines.push(clipped);
      used += clipped.length + 1;
    }
    return { name: `${roleIcons[name] ? roleIcons[name] + " " : ""}${name}`, value: lines.join("\n") || "—", inline: false };
  });
}

async function projectRaid(raidId: string): Promise<void> {
  const config = await discordIntegrationConfiguration();
  if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId) return;
  const raid = await raidEventFactsIncludingCancelled(raidId);
  if (!raid || !belongsToActiveGuild(raid.guildId, (await requireOperationalInstallationGuildBinding()).guildId)) return;
  const prior = await pool.query<Projection>(
    "SELECT discord_channel_id, discord_message_id FROM discord_raid_projections WHERE raid_id = $1", [raidId],
  );
  let existing: Projection | null = prior.rows[0] ?? null;
  // Destination changes affect future publications, not already-published messages.
  const channelId = existing?.discord_channel_id ?? config.raidChannelId;
  if (!channelId) return;
  const [rows, availableEmojis] = await Promise.all([
    raidSignups(raidId),
    discordApplicationEmojis(config.botToken, config.applicationId).catch((err: unknown) => {
      log.warn({ raidId, err }, "Discord emoji lookup failed; using plain-text raid presentation");
      return [];
    }),
  ]);
  const emojis: EmojiLookup = new Map(availableEmojis.map((emoji) => [emoji.name, discordApplicationEmojiMarkup(emoji)]));
  // Temporary thumbnail: reuse an already-provisioned Guild Operations role icon.
  // No external artwork dependency or new Raid configuration is required.
  const thumbnailEmoji = availableEmojis.find((emoji) => emoji.name === "go_raid_damage" && emoji.available !== false);
  const thumbnailUrl = thumbnailEmoji ? `https://cdn.discordapp.com/emojis/${thumbnailEmoji.id}.png?size=128` : null;
  const destinations = raidOccurrenceDestinations(raidId);
  const publicUrl = await installationAbsoluteUrl(destinations.find((item) => item.kind === "public")!.href);
  const signupUrl = await installationAbsoluteUrl(destinations.find((item) => item.kind === "participate")!.href);
  const status = raid.cancelledAtUnix !== null ? "Cancelled" : raid.concludedAtUnix !== null ? "Concluded" : null;
  const description = [
    raid.description ? safeText(raid.description).slice(0, 1600) : null,
    `**${safeText(raid.difficulty[0].toUpperCase() + raid.difficulty.slice(1))}**${status ? ` · **${status}**` : ""}`,
    `**Starts:** <t:${Math.floor(raid.occursAt[0])}:F>`,
    raid.occursAt[1] !== undefined ? `**Ends:** <t:${Math.floor(raid.occursAt[1])}:F>` : null,
    ...raid.requirements.slice(0, 8).map((requirement) => `**${safeText(requirement.label)}:** ${safeText(requirement.value)}`),
  ].filter(Boolean).join("\n").slice(0, 4096);
  const externalIds = [...new Set(rows.filter(row => row.actorKind === "external").map(row => row.actorReference))];
  const discordIds = new Map<string, string>();
  if (externalIds.length) {
    const identities = await pool.query<{ identity_id: string; discord_user_id: string }>(
      "SELECT identity_id, discord_user_id FROM discord_identities WHERE identity_id = ANY($1::uuid[])",
      [externalIds],
    );
    for (const identity of identities.rows) discordIds.set(`external:${identity.identity_id}`, identity.discord_user_id);
  }
  const nativeIds = [...new Set(rows.filter(row => row.actorKind === "native").map(row => row.actorReference))];
  if (nativeIds.length) {
    const linked = await pool.query<{ wow_identity_id: string; discord_user_id: string }>(
      `SELECT a.wow_identity_id, d.discord_user_id
         FROM identity_wow_associations a
         JOIN discord_identities d ON d.identity_id = a.external_identity_id
        WHERE a.wow_identity_id = ANY($1::uuid[])`,
      [nativeIds],
    );
    for (const identity of linked.rows) discordIds.set(`native:${identity.wow_identity_id}`, identity.discord_user_id);
  }
  const fields = rosterFields(rows, emojis, discordIds);

  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `${raid.cancelledAtUnix !== null ? "CANCELLED · " : ""}${safeText(raid.label)}`.slice(0, 256),
      url: publicUrl,
      description,
      fields,
      ...(thumbnailUrl ? { thumbnail: { url: thumbnailUrl } } : {}),
      // Match the established Raid difficulty palette in src/web/public/app.css.
      color: raid.cancelledAtUnix !== null ? 0xe05252 : ({ normal: 0x79c77b, heroic: 0xa67cff, mythic: 0xff6b63 })[raid.difficulty],
      footer: { text: "Guild Operations · Raid" },
    }],
    components: status ? [] : [{ type: 1, components: [
      { type: 2, style: 1, label: "Sign up", custom_id: `go:raid:start:${raidId}` },
      { type: 2, style: 2, label: "Withdraw", custom_id: `go:raid:withdraw:${raidId}` },
      { type: 2, style: 5, label: "View raid", url: signupUrl },
    ] }],
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
      } catch (error) {
        await publishInspectionBestEffort(
          () => publishOperationalRecord({
            source: "discord.raid-publication", operation: emission.code, kind: "exception",
            summary: "Discord raid projection failed",
            details: { raidId: emission.subject, error: error instanceof Error ? error.message : String(error) },
          }),
          (inspectionError) => log.error({ err: inspectionError, emissionCode: emission.code, raidId: emission.subject }, "Discord raid failure inspection publication failed"),
          () => {},
        );
        throw error;
      }
      await publishInspectionBestEffort(
        () => publishOperationalRecord({
          source: "discord.raid-publication", operation: emission.code, kind: "result", result: "success",
          summary: `Discord raid projection reconciled: ${emission.code}`,
          details: { raidId: emission.subject },
        }),
        (inspectionError) => log.error({ err: inspectionError, emissionCode: emission.code, raidId: emission.subject }, "Discord raid success inspection publication failed"),
        () => {},
      );
    },
  });
}
