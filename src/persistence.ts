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

async function resolveOrCreateSubject(
  client: PoolClient,
  region: Region,
  principalId: string,
): Promise<string> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${region}:${principalId}`]);

  const existing = await client.query<{ subject_id: string }>(
    "SELECT subject_id FROM blizzard_principals WHERE region = $1 AND principal_id = $2",
    [region, principalId],
  );
  if (existing.rowCount) {
    await client.query(
      "UPDATE blizzard_principals SET last_seen_at = now() WHERE subject_id = $1",
      [existing.rows[0].subject_id],
    );
    return existing.rows[0].subject_id;
  }

  const created = await client.query<{ subject_id: string }>(
    "INSERT INTO guild_subjects DEFAULT VALUES RETURNING subject_id",
  );
  const subjectId = created.rows[0].subject_id;
  await client.query(
    "INSERT INTO blizzard_principals (subject_id, region, principal_id) VALUES ($1, $2, $3)",
    [subjectId, region, principalId],
  );
  return subjectId;
}

async function effectiveGuildieRank(
  client: PoolClient,
  subjectId: string,
): Promise<number | null> {
  const result = await client.query<{ rank_index: number | null }>(
    `SELECT MIN(grm.rank_index)::integer AS rank_index
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
        AND grm.currently_present = true
      WHERE c.subject_id = $1
        AND c.currently_controlled = true
        AND grm.guild_id = $2`,
    [subjectId, config.guild.id],
  );
  return result.rows[0]?.rank_index ?? null;
}

function guildiePublication(
  subjectId: string,
  beforeRank: number | null,
  afterRank: number | null,
): PublishedEvent | null {
  if (beforeRank === null && afterRank !== null) {
    return { kind: "guildie.joined", subjectId, guildId: config.guild.id };
  }
  if (beforeRank !== null && afterRank === null) {
    return { kind: "guildie.left", subjectId, guildId: config.guild.id };
  }
  if (beforeRank !== null && afterRank !== null && beforeRank !== afterRank) {
    return { kind: "guildie.rank.changed", subjectId, guildId: config.guild.id };
  }
  return null;
}

export async function establishOrResolveSubject(input: {
  region: Region;
  principalId: string;
  profile: BlizzardWowProfile;
}): Promise<string> {
  const established = await withTransaction(async (client) => {
    const subjectId = await resolveOrCreateSubject(client, input.region, input.principalId);
    const beforeGuildieRank = await effectiveGuildieRank(client, subjectId);

    // Preserve every previously observed character, but make the latest successful
    // Blizzard profile observation authoritative for current control.
    await client.query(
      "UPDATE characters SET currently_controlled = false WHERE subject_id = $1 AND region = $2",
      [subjectId, input.region],
    );

    for (const account of input.profile.wow_accounts ?? []) {
      const accountResult = await client.query<{ wow_account_record_id: string }>(
        `INSERT INTO wow_accounts (subject_id, region, wow_account_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (region, wow_account_id) DO UPDATE
           SET last_seen_at = now()
           WHERE wow_accounts.subject_id = EXCLUDED.subject_id
         RETURNING wow_account_record_id`,
        [subjectId, input.region, String(account.id)],
      );

      if (!accountResult.rowCount) {
        throw new Error("Blizzard WoW account coordinate is already owned by another subject");
      }
      const wowAccountRecordId = accountResult.rows[0].wow_account_record_id;

      for (const character of account.characters ?? []) {
        const result = await client.query(
          `INSERT INTO characters (
             subject_id, wow_account_record_id, region, realm_id, character_id,
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
           WHERE characters.subject_id = EXCLUDED.subject_id
           RETURNING character_record_id`,
          [
            subjectId,
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
          throw new Error("Blizzard character coordinate is already owned by another subject");
        }
      }
    }

    const afterGuildieRank = await effectiveGuildieRank(client, subjectId);
    const publication = guildiePublication(subjectId, beforeGuildieRank, afterGuildieRank);

    await client.query("UPDATE guild_subjects SET updated_at = now() WHERE subject_id = $1", [subjectId]);
    return { subjectId, publication };
  });

  if (established.publication) await publishEvent(established.publication);
  return established.subjectId;
}
