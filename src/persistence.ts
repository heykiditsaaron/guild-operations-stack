import type { PoolClient } from "pg";
import type { BlizzardWowProfile } from "./blizzard.js";
import { config, type Region } from "./config.js";
import { withTransaction } from "./db.js";
import { publishEvent, type PublishedEvent } from "./events/publisher.js";

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

async function resolveOrCreateGuildie(
  client: PoolClient,
  region: Region,
  principalId: string,
): Promise<string> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${region}:${principalId}`]);

  const existing = await client.query<{ guildie_id: string }>(
    "SELECT guildie_id FROM blizzard_principals WHERE region = $1 AND principal_id = $2",
    [region, principalId],
  );
  if (existing.rowCount) {
    await client.query(
      "UPDATE blizzard_principals SET last_seen_at = now() WHERE guildie_id = $1",
      [existing.rows[0].guildie_id],
    );
    return existing.rows[0].guildie_id;
  }

  const created = await client.query<{ guildie_id: string }>(
    "INSERT INTO guildies DEFAULT VALUES RETURNING guildie_id",
  );
  const guildieId = created.rows[0].guildie_id;
  await client.query(
    "INSERT INTO blizzard_principals (guildie_id, region, principal_id) VALUES ($1, $2, $3)",
    [guildieId, region, principalId],
  );
  return guildieId;
}

async function effectiveGuildieRank(
  client: PoolClient,
  guildieId: string,
): Promise<number | null> {
  const result = await client.query<{ rank_index: number | null }>(
    `SELECT MIN(grm.rank_index)::integer AS rank_index
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
        AND grm.currently_present = true
      WHERE c.guildie_id = $1
        AND c.currently_controlled = true
        AND grm.guild_id = $2`,
    [guildieId, config.guild.id],
  );
  return result.rows[0]?.rank_index ?? null;
}

function guildiePublication(
  guildieId: string,
  beforeRank: number | null,
  afterRank: number | null,
): PublishedEvent | null {
  if (beforeRank === null && afterRank !== null) {
    return { kind: "guildie.joined", guildieId, guildId: config.guild.id };
  }
  if (beforeRank !== null && afterRank === null) {
    return { kind: "guildie.left", guildieId, guildId: config.guild.id };
  }
  if (beforeRank !== null && afterRank !== null && beforeRank !== afterRank) {
    return { kind: "guildie.rank.changed", guildieId, guildId: config.guild.id };
  }
  return null;
}

async function reconcileGuildieBlizzardObservation(
  client: PoolClient,
  input: {
    guildieId: string;
    region: Region;
    profile: BlizzardWowProfile;
  },
): Promise<PublishedEvent | null> {
  const beforeGuildieRank = await effectiveGuildieRank(client, input.guildieId);

  // Preserve every previously observed character, but make the latest successful
  // Blizzard profile observation authoritative for current control.
  await client.query(
    "UPDATE characters SET currently_controlled = false WHERE guildie_id = $1 AND region = $2",
    [input.guildieId, input.region],
  );

  for (const account of input.profile.wow_accounts ?? []) {
    const accountResult = await client.query<{ wow_account_record_id: string }>(
      `INSERT INTO wow_accounts (guildie_id, region, wow_account_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (region, wow_account_id) DO UPDATE
         SET last_seen_at = now()
         WHERE wow_accounts.guildie_id = EXCLUDED.guildie_id
       RETURNING wow_account_record_id`,
      [input.guildieId, input.region, String(account.id)],
    );

    if (!accountResult.rowCount) {
      throw new Error("Blizzard WoW account coordinate is already owned by another Guildie");
    }
    const wowAccountRecordId = accountResult.rows[0].wow_account_record_id;

    for (const character of account.characters ?? []) {
      const result = await client.query(
        `INSERT INTO characters (
           guildie_id, wow_account_record_id, region, realm_id, character_id,
           name, realm_name, realm_slug, level, faction, currently_controlled
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
         ON CONFLICT (region, realm_id, character_id) DO UPDATE SET
           wow_account_record_id = EXCLUDED.wow_account_record_id,
           name = EXCLUDED.name,
           realm_name = EXCLUDED.realm_name,
           realm_slug = EXCLUDED.realm_slug,
           level = EXCLUDED.level,
           faction = EXCLUDED.faction,
           currently_controlled = true,
           last_seen_at = now()
         WHERE characters.guildie_id = EXCLUDED.guildie_id
         RETURNING character_record_id`,
        [
          input.guildieId,
          wowAccountRecordId,
          input.region,
          String(character.realm.id),
          String(character.id),
          character.name,
          localizedValue(character.realm.name),
          character.realm.slug ?? null,
          character.level ?? null,
          factionValue(character.faction),
        ],
      );
      if (!result.rowCount) {
        throw new Error("Blizzard character coordinate is already owned by another Guildie");
      }
    }
  }

  const afterGuildieRank = await effectiveGuildieRank(client, input.guildieId);
  const publication = guildiePublication(input.guildieId, beforeGuildieRank, afterGuildieRank);
  await client.query("UPDATE guildies SET updated_at = now() WHERE guildie_id = $1", [input.guildieId]);
  return publication;
}

export async function reconcileExistingGuildieBlizzardObservation(input: {
  guildieId: string;
  region: Region;
  principalId: string;
  profile: BlizzardWowProfile;
}): Promise<void> {
  const reconciled = await withTransaction(async (client) => {
    const principal = await client.query(
      `UPDATE blizzard_principals
          SET last_seen_at = now()
        WHERE guildie_id = $1
          AND region = $2
          AND principal_id = $3
      RETURNING guildie_id`,
      [input.guildieId, input.region, input.principalId],
    );
    if (!principal.rowCount) {
      throw new Error("Blizzard principal is not bound to the existing Guildie");
    }

    return reconcileGuildieBlizzardObservation(client, {
      guildieId: input.guildieId,
      region: input.region,
      profile: input.profile,
    });
  });

  if (reconciled) await publishEvent(reconciled);
}

export async function establishOrResolveGuildie(input: {
  region: Region;
  principalId: string;
  profile: BlizzardWowProfile;
}): Promise<string> {
  const established = await withTransaction(async (client) => {
    const guildieId = await resolveOrCreateGuildie(client, input.region, input.principalId);
    const publication = await reconcileGuildieBlizzardObservation(client, {
      guildieId,
      region: input.region,
      profile: input.profile,
    });
    return { guildieId, publication };
  });

  if (established.publication) await publishEvent(established.publication);
  return established.guildieId;
}
