import { config, type Region } from "./config.js";
import { pool } from "./db.js";
import { effectiveGuildAuthority, type EffectiveGuildAuthority } from "./guild-permissions.js";
import { guildCharactersForGuildie, type GuildCharacter } from "./guild.js";
import { mainCharacterForGuildie, type SelectedMainCharacter } from "./core/identity/main-character.js";

export type GuildState = {
  guildId: string;
  region: Region;
  realmId: string;
  name: string;
  realmName: string | null;
  realmSlug: string;
  faction: string | null;
};

export type GuildRankDefinition = {
  guildId: string;
  rankIndex: number;
  displayName: string;
};

export type CharacterMembershipCoordinate = {
  guildId: string;
  region: Region;
  realmId: string;
  characterId: string;
};

export type CharacterMembership = CharacterMembershipCoordinate & {
  currentlyPresent: true;
  rankIndex: number;
  characterName: string;
  realmName: string | null;
  realmSlug: string | null;
};

export type GuildieSelectedMain = SelectedMainCharacter & {
  character: GuildCharacter | null;
};

export type GuildieState = {
  guildieId: string;
  characters: GuildCharacter[];
  selectedMain: GuildieSelectedMain | null;
  guildAuthority: EffectiveGuildAuthority | null;
};

export async function guildState(guildId: string = config.guild.id): Promise<GuildState | null> {
  const result = await pool.query<{
    guild_id: string;
    region: Region;
    realm_id: string;
    name: string;
    realm_name: string | null;
    realm_slug: string;
    faction: string | null;
  }>(
    `SELECT guild_id, region, realm_id, name, realm_name, realm_slug, faction
       FROM guilds
      WHERE guild_id = $1`,
    [guildId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    guildId: row.guild_id,
    region: row.region,
    realmId: row.realm_id,
    name: row.name,
    realmName: row.realm_name,
    realmSlug: row.realm_slug,
    faction: row.faction,
  };
}

export async function guildRankDefinitions(
  guildId: string = config.guild.id,
): Promise<GuildRankDefinition[]> {
  const result = await pool.query<{
    guild_id: string;
    rank_index: number;
    display_name: string | null;
  }>(
    `SELECT guild_id, rank_index, display_name
       FROM guild_rank_definitions
      WHERE guild_id = $1
        AND active = true
      ORDER BY rank_index`,
    [guildId],
  );

  return result.rows.map((row) => ({
    guildId: row.guild_id,
    rankIndex: row.rank_index,
    displayName: row.display_name ?? `Rank ${row.rank_index}`,
  }));
}

export async function characterMembership(
  coordinate: CharacterMembershipCoordinate,
): Promise<CharacterMembership | null> {
  const result = await pool.query<{
    rank_index: number;
    character_name: string;
    realm_name: string | null;
    realm_slug: string | null;
  }>(
    `SELECT rank_index, character_name, realm_name, realm_slug
       FROM guild_roster_memberships
      WHERE guild_id = $1
        AND region = $2
        AND realm_id = $3
        AND character_id = $4
        AND currently_present = true`,
    [coordinate.guildId, coordinate.region, coordinate.realmId, coordinate.characterId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...coordinate,
    currentlyPresent: true,
    rankIndex: row.rank_index,
    characterName: row.character_name,
    realmName: row.realm_name,
    realmSlug: row.realm_slug,
  };
}

export async function guildieState(guildieId: string): Promise<GuildieState | null> {
  const exists = await pool.query<{ guildie_id: string }>(
    "SELECT guildie_id FROM guildies WHERE guildie_id = $1",
    [guildieId],
  );
  if (!exists.rowCount) return null;

  const [characters, selectedMain, guildAuthority] = await Promise.all([
    guildCharactersForGuildie(guildieId),
    mainCharacterForGuildie(guildieId),
    effectiveGuildAuthority(guildieId),
  ]);

  const selectedMainCharacter = selectedMain
    ? characters.find((character) =>
        character.realmId === selectedMain.realmId && character.characterId === selectedMain.characterId,
      ) ?? null
    : null;

  const resolvedSelectedMain = selectedMain
    ? {
        ...selectedMain,
        name: selectedMainCharacter?.name ?? selectedMain.name,
        realmName: selectedMainCharacter?.realmName ?? selectedMain.realmName,
        rankIndex: selectedMainCharacter?.rankIndex ?? selectedMain.rankIndex,
        currentlyEligible: selectedMainCharacter !== null && selectedMain.currentlyEligible,
        avatarUrl: selectedMainCharacter?.avatarUrl ?? selectedMain.avatarUrl,
        character: selectedMainCharacter,
      }
    : null;

  return {
    guildieId,
    characters,
    selectedMain: resolvedSelectedMain,
    guildAuthority,
  };
}
