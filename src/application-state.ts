import { config, type Region } from "./config.js";
import { pool } from "./db.js";
import { discordAssociationForGuildie, type DiscordAssociation } from "./discord-association.js";
import { effectiveGuildAuthority, type EffectiveGuildAuthority } from "./guild-permissions.js";
import { guildCharactersForGuildie, type GuildCharacter } from "./guild.js";
import { mainCharacterForGuildie, type SelectedMainCharacter } from "./main-character.js";

export type GuildState = {
  guildId: string;
  region: Region;
  realmId: string;
  name: string;
  realmName: string | null;
  realmSlug: string;
  faction: string | null;
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

export type GuildieState = {
  guildieId: string;
  characters: GuildCharacter[];
  selectedMain: SelectedMainCharacter | null;
  guildAuthority: EffectiveGuildAuthority | null;
  discordAssociation: DiscordAssociation | null;
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

  const [characters, selectedMain, guildAuthority, discordAssociation] = await Promise.all([
    guildCharactersForGuildie(guildieId),
    mainCharacterForGuildie(guildieId),
    effectiveGuildAuthority(guildieId),
    discordAssociationForGuildie(guildieId),
  ]);

  return {
    guildieId,
    characters,
    selectedMain,
    guildAuthority,
    discordAssociation,
  };
}
