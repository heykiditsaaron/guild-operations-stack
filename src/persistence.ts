import type { PoolClient } from "pg";
import type { Region } from "./config.js";
import type { BlizzardWowProfile } from "./blizzard.js";
import { withTransaction } from "./db.js";

function factionValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const typed = value as { type?: unknown; name?: unknown };
    if (typeof typed.type === "string") return typed.type;
    if (typeof typed.name === "string") return typed.name;
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

export async function establishOrResolveSubject(input: {
  region: Region;
  principalId: string;
  profile: BlizzardWowProfile;
}): Promise<string> {
  return withTransaction(async (client) => {
    const subjectId = await resolveOrCreateSubject(client, input.region, input.principalId);

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
             name, realm_name, realm_slug, level, faction
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (region, realm_id, character_id) DO UPDATE SET
             wow_account_record_id = EXCLUDED.wow_account_record_id,
             name = EXCLUDED.name,
             realm_name = EXCLUDED.realm_name,
             realm_slug = EXCLUDED.realm_slug,
             level = EXCLUDED.level,
             faction = EXCLUDED.faction,
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
            character.realm.name ?? null,
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

    await client.query("UPDATE guild_subjects SET updated_at = now() WHERE subject_id = $1", [subjectId]);
    return subjectId;
  });
}
