import { pool, withTransaction } from "../../db.js";
import { installationGuildBinding, resolveConfiguredInstallationGuild } from "./guild-binding.js";
import { configuredInstallationGuild, installationRebindRequested } from "./target.js";
import { persistGuildRoster } from "../guild/guild-refresh.js";

/**
 * The host's explicit configuration opens the ceremony. Only a current
 * destination Guild Master who controls a Blizzard-observed character may
 * complete it. Never use the original-install development bypass here.
 */
export async function installationRebindPreview() {
  if (!installationRebindRequested()) return null;
  const binding = await installationGuildBinding();
  if (!binding?.authorizedAt) return null;
  const target = configuredInstallationGuild();
  if (!target) throw new Error("Rebind target is not configured");
  const authority = await resolveConfiguredInstallationGuild();
  if (binding.guildId === String(authority.profile.id)) return null;
  const existing = await pool.query<{ name: string; realm_slug: string; region: string }>(
    "SELECT name, realm_slug, region FROM guilds WHERE guild_id = $1",
    [binding.guildId],
  );
  return {
    previous: { guildId: binding.guildId, ...existing.rows[0] },
    destination: {
      guildId: String(authority.profile.id),
      name: authority.profile.name,
      realmSlug: authority.profile.realm.slug,
      region: target.region,
    },
  };
}

export async function authorizeInstallationRebind(identityId: string) {
  if (!installationRebindRequested()) throw new Error("Host has not enabled guild rebinding");
  const target = configuredInstallationGuild();
  if (!target) throw new Error("Rebind target is not configured");
  // Acquire the roster from Blizzard on every authorization attempt, not from
  // a previously persisted guild roster or an existing member capability.
  const authority = await resolveConfiguredInstallationGuild();
  const destinationId = String(authority.profile.id);
  const guildMasterCharacters = (authority.roster.members ?? [])
    .filter((member) => member.rank === 0)
    .map((member) => member.character)
    .filter((character) => character?.id && character.realm?.id)
    .map((character) => ({
      region: target.region,
      realmId: String(character.realm.id),
      characterId: String(character.id),
    }));
  if (!guildMasterCharacters.length) throw new Error("Destination guild has no verifiable Guild Master");
  const owned = await pool.query<{ character_id: string; realm_id: string; region: string }>(
    `SELECT cr.character_id, cr.realm_id, cr.region
       FROM controlled_character_roster ccr
       JOIN character_roster cr ON cr.character_record_id = ccr.character_record_id
      WHERE ccr.identity_id = $1 AND ccr.currently_controlled = true`,
    [identityId],
  );
  if (!guildMasterCharacters.some((gm) =>
    owned.rows.some((row) => row.region === gm.region
      && row.realm_id === gm.realmId && row.character_id === gm.characterId))) {
    throw new Error("Current destination Guild Master authority is required");
  }

  return withTransaction(async (client) => {
    const bindingResult = await client.query<{ guild_id: string; authorized_at: Date | null }>(
      "SELECT guild_id, authorized_at FROM installation_guild_binding WHERE singleton = true FOR UPDATE",
    );
    const binding = bindingResult.rows[0];
    if (!binding?.authorized_at) throw new Error("Installation is not operational");
    if (!installationRebindRequested()) throw new Error("Host has disabled guild rebinding");

    // A leftover host flag after completion cannot repeat the transition.
    const sameGuild = binding.guild_id === destinationId;

    const guild = authority.profile;
    await client.query(
      `INSERT INTO guilds
         (guild_id, region, realm_id, name, realm_name, realm_slug, blizzard_reference_href)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (guild_id) DO UPDATE SET
         region=EXCLUDED.region, realm_id=EXCLUDED.realm_id,
         name=EXCLUDED.name, realm_name=EXCLUDED.realm_name,
         realm_slug=EXCLUDED.realm_slug,
         blizzard_reference_href=EXCLUDED.blizzard_reference_href,
         last_seen_at=now()`,
      [destinationId, target.region, String(guild.realm.id), guild.name,
        typeof guild.realm.name === "string" ? guild.realm.name : null,
        guild.realm.slug,
        authority.referenceHref],
    );
    await persistGuildRoster(client, destinationId, target.region, authority.roster);
    if (!sameGuild) {
    await client.query(
      `UPDATE installation_guild_binding SET
         guild_id=$1, bound_at=now(), bound_by_identity_id=$2,
         authorized_at=now(), authorized_by_identity_id=$2,
         authorization_kind='guild_master'
       WHERE singleton=true`,
      [destinationId, identityId],
    );
    await client.query(
      `INSERT INTO installation_guild_rebindings
         (previous_guild_id, destination_guild_id, authorized_by_identity_id)
       VALUES ($1,$2,$3)`,
      [binding.guild_id, destinationId, identityId],
    );
    }
    return { guildId: destinationId, changed: !sameGuild };
  });
}
