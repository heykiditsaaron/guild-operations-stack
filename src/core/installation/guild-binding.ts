import type { PoolClient } from "pg";
import { acquireGuildAuthorityByReference, type BlizzardGuildProfile } from "../../blizzard.js";
import type { Region } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import { controlledCharacterRecordIdsForIdentity } from "../identity/controlled-characters.js";
import { characterProjections } from "../identity/character-projection.js";
import { persistGuildRoster } from "../guild/guild-refresh.js";
import { hasDevelopmentGuildMasterAuthority } from "../authority/operator-authority.js";
import { discoverInstallationGuildCandidates } from "./guild-candidates.js";

function localizedValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    if (typeof localized.en_US === "string") return localized.en_US;
    const first = Object.values(localized).find((candidate) => typeof candidate === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}

function factionValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const typed = value as { type?: unknown; name?: unknown };
    if (typeof typed.type === "string") return typed.type;
    if (typeof typed.name === "string") return typed.name;
  }
  return null;
}

async function persistGuild(client: PoolClient, region: Region, profile: BlizzardGuildProfile, referenceHref: string): Promise<string> {
  const guildId = String(profile.id);
  const realmId = String(profile.realm.id);
  const realmSlug = profile.realm.slug;
  if (!profile.name || !realmSlug) throw new Error("Blizzard guild profile omitted required coordinates");

  await client.query(
    `INSERT INTO guilds (
       guild_id, region, realm_id, name, realm_name, realm_slug, faction, created_timestamp, blizzard_reference_href
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (guild_id) DO UPDATE SET
       region=EXCLUDED.region, realm_id=EXCLUDED.realm_id, name=EXCLUDED.name,
       realm_name=EXCLUDED.realm_name, realm_slug=EXCLUDED.realm_slug,
       faction=EXCLUDED.faction, created_timestamp=EXCLUDED.created_timestamp,
       blizzard_reference_href=EXCLUDED.blizzard_reference_href, last_seen_at=now()`,
    [guildId, region, realmId, profile.name, localizedValue(profile.realm.name), realmSlug,
      factionValue(profile.faction), profile.created_timestamp ?? null, referenceHref],
  );
  return guildId;
}

export type InstallationGuildBinding = {
  guildId: string;
  boundAt: Date;
  boundByIdentityId: string | null;
  authorizedAt: Date | null;
  authorizedByIdentityId: string | null;
  authorizationKind: "guild_master" | "original_install_bypass" | null;
};

export async function installationGuildBinding(): Promise<InstallationGuildBinding | null> {
  const result = await pool.query<{
    guild_id: string; bound_at: Date; bound_by_identity_id: string | null;
    authorized_at: Date | null; authorized_by_identity_id: string | null;
    authorization_kind: InstallationGuildBinding["authorizationKind"];
  }>(`SELECT guild_id, bound_at, bound_by_identity_id, authorized_at,
             authorized_by_identity_id, authorization_kind
        FROM installation_guild_binding WHERE singleton = true`);
  const row = result.rows[0];
  return row ? {
    guildId: row.guild_id,
    boundAt: row.bound_at,
    boundByIdentityId: row.bound_by_identity_id,
    authorizedAt: row.authorized_at,
    authorizedByIdentityId: row.authorized_by_identity_id,
    authorizationKind: row.authorization_kind,
  } : null;
}

export async function establishPendingInstallationGuildBinding(input: {
  identityId: string;
  region: Region;
  guildId: string;
}): Promise<InstallationGuildBinding> {
  if (await installationGuildBinding()) throw new Error("Installation is already bound to a guild");

  const candidates = await discoverInstallationGuildCandidates(input.identityId);
  const candidate = candidates.find((value) => value.region === input.region && value.guildId === input.guildId);
  if (!candidate) throw new Error("Selected guild is not a current controlled-character guild candidate");

  const authority = await acquireGuildAuthorityByReference({
    region: candidate.region,
    referenceHref: candidate.referenceHref,
  });
  if (
    String(authority.profile.id) !== candidate.guildId
    || String(authority.roster.guild.id) !== candidate.guildId
  ) {
    throw new Error("Blizzard guild authority did not corroborate the selected guild");
  }
  if (
    String(authority.profile.realm.id) !== candidate.realmId
    || authority.profile.realm.slug !== candidate.realmSlug
  ) {
    throw new Error("Blizzard guild profile did not corroborate the selected guild realm");
  }

  const controlled = await characterProjections(await controlledCharacterRecordIdsForIdentity(input.identityId));
  const controlledCoordinates = new Set(controlled.map((character) =>
    `${character.region}:${character.realmId}:${character.characterId}`
  ));
  const currentlyPresent = (authority.roster.members ?? []).some((member) => {
    const character = member.character;
    return controlledCoordinates.has(
      `${candidate.region}:${String(character.realm.id)}:${String(character.id)}`
    );
  });
  if (!currentlyPresent) throw new Error("Selected guild roster does not contain a currently controlled character");

  await withTransaction(async (client) => {
    const guildId = await persistGuild(client, candidate.region, authority.profile, candidate.referenceHref);
    await persistGuildRoster(client, guildId, candidate.region, authority.roster);
    await client.query(
      `INSERT INTO installation_guild_binding (singleton, guild_id, bound_by_identity_id)
       VALUES (true, $1, $2)`,
      [guildId, input.identityId],
    );
  });

  const binding = await installationGuildBinding();
  if (!binding) throw new Error("Installation guild binding was not persisted");
  return binding;
}


export async function authorizeInstallationGuildBinding(
  identityId: string,
): Promise<InstallationGuildBinding> {
  const binding = await installationGuildBinding();
  if (!binding) throw new Error("Installation is not bound to a guild");
  if (binding.authorizedAt) return binding;

  const rankResult = await pool.query<{ rank_index: number }>(
    `SELECT MIN(gr.rank_index)::integer AS rank_index
       FROM controlled_character_roster ccr
       JOIN guild_roster gr
         ON gr.character_record_id = ccr.character_record_id
        AND gr.currently_present = true
      WHERE ccr.identity_id = $1
        AND ccr.currently_controlled = true
        AND gr.guild_id = $2
      HAVING count(*) > 0`,
    [identityId, binding.guildId],
  );
  const rankIndex = rankResult.rows[0]?.rank_index;
  const authorizationKind = rankIndex === 0
    ? "guild_master"
    : rankIndex !== undefined && hasDevelopmentGuildMasterAuthority(identityId)
      ? "original_install_bypass"
      : null;
  if (!authorizationKind) {
    throw new Error("Installation authorization requires current Guild Master authority");
  }

  await pool.query(
    `UPDATE installation_guild_binding
        SET authorized_at = now(),
            authorized_by_identity_id = $1,
            authorization_kind = $2
      WHERE singleton = true
        AND authorized_at IS NULL`,
    [identityId, authorizationKind],
  );

  const authorized = await installationGuildBinding();
  if (!authorized?.authorizedAt) throw new Error("Installation guild authorization was not persisted");
  return authorized;
}

export async function installationOperational(): Promise<boolean> {
  return (await installationGuildBinding())?.authorizedAt != null;
}


export async function requireInstallationGuildBinding(): Promise<InstallationGuildBinding> {
  const binding = await installationGuildBinding();
  if (!binding) throw new Error("Installation is not bound to a guild");
  return binding;
}

export async function requireOperationalInstallationGuildBinding(): Promise<InstallationGuildBinding> {
  const binding = await requireInstallationGuildBinding();
  if (!binding.authorizedAt) throw new Error("Installation guild binding is not authorized");
  return binding;
}
