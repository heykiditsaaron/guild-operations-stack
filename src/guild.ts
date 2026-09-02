import type { PoolClient } from "pg";
import { acquireGuildAuthority, type BlizzardGuildProfile, type BlizzardGuildRoster } from "./blizzard.js";
import { config, type Region } from "./config.js";
import { pool, withTransaction } from "./db.js";
import {
  enrichGuildCharacters,
  guildCharactersNeedingEnrichment,
  type GuildCharacterCoordinate,
} from "./guild-character-enrichment.js";

function factionValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const typed = value as { type?: unknown; name?: unknown };
    if (typeof typed.type === "string") return typed.type;
    if (typeof typed.name === "string") return typed.name;
  }
  return null;
}

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

function coordinateKey(character: GuildCharacterCoordinate): string {
  return `${character.region}:${character.realmId}:${character.characterId}`;
}

async function persistGuild(
  client: PoolClient,
  region: Region,
  profile: BlizzardGuildProfile,
): Promise<string> {
  const guildId = String(profile.id);
  const realmId = String(profile.realm.id);
  const realmName = localizedValue(profile.realm.name);
  const realmSlug = profile.realm.slug;

  if (!profile.name || !realmSlug) {
    throw new Error("Blizzard guild profile omitted required presentation coordinates");
  }

  await client.query(
    `INSERT INTO guilds (
       guild_id, region, realm_id, name, realm_name, realm_slug, faction, created_timestamp
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (guild_id) DO UPDATE SET
       region = EXCLUDED.region,
       realm_id = EXCLUDED.realm_id,
       name = EXCLUDED.name,
       realm_name = EXCLUDED.realm_name,
       realm_slug = EXCLUDED.realm_slug,
       faction = EXCLUDED.faction,
       created_timestamp = EXCLUDED.created_timestamp,
       last_seen_at = now()`,
    [
      guildId,
      region,
      realmId,
      profile.name,
      realmName,
      realmSlug,
      factionValue(profile.faction),
      profile.created_timestamp ?? null,
    ],
  );

  return guildId;
}

async function ensureObservedRankDefinition(
  client: PoolClient,
  guildId: string,
  rankIndex: number,
): Promise<void> {
  await client.query(
    `INSERT INTO guild_rank_definitions (guild_id, rank_index, display_name, active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (guild_id, rank_index) DO UPDATE SET
       active = true,
       updated_at = now()`,
    [guildId, rankIndex, `Rank ${rankIndex}`],
  );

  if (rankIndex === 0 || rankIndex === 1 || rankIndex === 2) {
    await client.query(
      `INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
       VALUES ($1, $2, 'guild.refresh')
       ON CONFLICT (guild_id, rank_index, capability) DO NOTHING`,
      [guildId, rankIndex],
    );
  }
}

async function persistRoster(
  client: PoolClient,
  guildId: string,
  region: Region,
  roster: BlizzardGuildRoster,
): Promise<{
  observed: number;
  changedPresentationCoordinates: GuildCharacterCoordinate[];
}> {
  const existingResult = await client.query<{
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_name: string | null;
    realm_slug: string | null;
    currently_present: boolean;
  }>(
    `SELECT region, realm_id, character_id, character_name, realm_name, realm_slug, currently_present
       FROM guild_roster_memberships
      WHERE guild_id = $1`,
    [guildId],
  );
  const existing = new Map(existingResult.rows.map((row) => [
    coordinateKey({ region: row.region, realmId: row.realm_id, characterId: row.character_id }),
    row,
  ]));

  await client.query(
    `UPDATE guild_roster_memberships
        SET currently_present = false
      WHERE guild_id = $1
        AND currently_present = true`,
    [guildId],
  );

  const observedRanks = new Set<number>();
  const changedPresentationCoordinates: GuildCharacterCoordinate[] = [];
  let observed = 0;

  for (const member of roster.members ?? []) {
    const character = member.character;
    if (!character?.id || !character.realm?.id || !character.name || !Number.isInteger(member.rank)) {
      throw new Error("Blizzard guild roster member omitted a required canonical coordinate or rank");
    }

    const coordinate: GuildCharacterCoordinate = {
      region,
      realmId: String(character.realm.id),
      characterId: String(character.id),
    };
    const realmName = localizedValue(character.realm.name);
    const realmSlug = character.realm.slug ?? null;
    const previous = existing.get(coordinateKey(coordinate));

    if (
      !previous
      || !previous.currently_present
      || previous.character_name !== character.name
      || previous.realm_name !== realmName
      || previous.realm_slug !== realmSlug
    ) {
      changedPresentationCoordinates.push(coordinate);
    }

    await client.query(
      `INSERT INTO guild_roster_memberships (
         guild_id, region, realm_id, character_id, rank_index,
         character_name, realm_name, realm_slug
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (guild_id, region, realm_id, character_id) DO UPDATE SET
         rank_index = EXCLUDED.rank_index,
         character_name = EXCLUDED.character_name,
         realm_name = EXCLUDED.realm_name,
         realm_slug = EXCLUDED.realm_slug,
         last_seen_at = now(),
         currently_present = true`,
      [
        guildId,
        region,
        coordinate.realmId,
        coordinate.characterId,
        member.rank,
        character.name,
        realmName,
        realmSlug,
      ],
    );
    observedRanks.add(member.rank);
    observed += 1;
  }

  for (const rankIndex of observedRanks) {
    await ensureObservedRankDefinition(client, guildId, rankIndex);
  }

  return { observed, changedPresentationCoordinates };
}

export async function refreshGuildAuthority(): Promise<{
  guildId: string;
  rosterCount: number;
  reconciliation: {
    charactersTargeted: number;
    profilesUpdated: number;
    mediaUpdated: number;
    failedProfiles: number;
    failedMedia: number;
    apiCalls: number;
    failures: Array<{
      characterId: string;
      realmId: string;
      name: string;
      stage: "profile" | "media";
      error: string;
    }>;
  };
}> {
  const authority = await acquireGuildAuthority(config.guild);

  if (String(authority.profile.id) !== config.guild.id) {
    throw new Error(
      `Configured guild locator resolved unexpected Blizzard guild id ${String(authority.profile.id)}`,
    );
  }

  if (String(authority.roster.guild.id) !== config.guild.id) {
    throw new Error("Blizzard guild roster does not corroborate the configured guild id");
  }

  const persisted = await withTransaction(async (client) => {
    const guildId = await persistGuild(client, config.guild.region, authority.profile);
    const roster = await persistRoster(client, guildId, config.guild.region, authority.roster);
    return { guildId, roster };
  });

  const targets = await guildCharactersNeedingEnrichment(
    persisted.guildId,
    persisted.roster.changedPresentationCoordinates,
  );
  const enrichment = await enrichGuildCharacters({ guildId: persisted.guildId, targets });

  return {
    guildId: persisted.guildId,
    rosterCount: persisted.roster.observed,
    reconciliation: {
      charactersTargeted: enrichment.attempted,
      profilesUpdated: enrichment.profilesUpdated,
      mediaUpdated: enrichment.mediaUpdated,
      failedProfiles: enrichment.failedProfiles,
      failedMedia: enrichment.failedMedia,
      apiCalls: enrichment.apiCalls,
      failures: enrichment.failures,
    },
  };
}

export async function guildCharactersForSubject(subjectId: string): Promise<Array<{
  guildId: string;
  characterId: string;
  realmId: string;
  name: string;
  realmName: string | null;
  rankIndex: number;
  level: number | null;
  className: string | null;
  raceName: string | null;
  activeSpecName: string | null;
  avatarUrl: string | null;
  insetUrl: string | null;
  mainUrl: string | null;
}>> {
  const result = await pool.query<{
    guild_id: string;
    character_id: string;
    realm_id: string;
    character_name: string;
    realm_name: string | null;
    rank_index: number;
    level: number | null;
    class_name: string | null;
    race_name: string | null;
    active_spec_name: string | null;
    avatar_url: string | null;
    inset_url: string | null;
    main_url: string | null;
  }>(
    `SELECT
       grm.guild_id,
       grm.character_id,
       grm.realm_id,
       COALESCE(wcp.name, grm.character_name) AS character_name,
       COALESCE(wcp.realm_name, grm.realm_name) AS realm_name,
       grm.rank_index,
       wcp.level,
       wcp.class_name,
       wcp.race_name,
       wcp.active_spec_name,
       wcp.avatar_url,
       wcp.inset_url,
       wcp.main_url
     FROM characters c
     JOIN guild_roster_memberships grm
       ON grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
      AND grm.currently_present = true
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = grm.region
      AND wcp.realm_id = grm.realm_id
      AND wcp.character_id = grm.character_id
     WHERE c.subject_id = $1
       AND c.currently_controlled = true
       AND grm.guild_id = $2
     ORDER BY grm.rank_index, grm.character_name`,
    [subjectId, config.guild.id],
  );

  return result.rows.map((row) => ({
    guildId: row.guild_id,
    characterId: row.character_id,
    realmId: row.realm_id,
    name: row.character_name,
    realmName: row.realm_name,
    rankIndex: row.rank_index,
    level: row.level,
    className: row.class_name,
    raceName: row.race_name,
    activeSpecName: row.active_spec_name,
    avatarUrl: row.avatar_url,
    insetUrl: row.inset_url,
    mainUrl: row.main_url,
  }));
}
