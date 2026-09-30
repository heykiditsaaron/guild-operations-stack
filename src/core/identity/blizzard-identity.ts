import type { PoolClient } from "pg";
import type { BlizzardWowAccount, BlizzardWowProfile } from "../../blizzard.js";
import { type Region } from "../../config.js";
import { withTransaction } from "../../db.js";

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

export type DiscoveredWowAccount = {
  wowAccountId: string;
  characters: BlizzardWowAccount["characters"];
};

export function discoveredWowAccounts(profile: BlizzardWowProfile): DiscoveredWowAccount[] {
  return (profile.wow_accounts ?? []).map((account) => ({
    wowAccountId: String(account.id),
    characters: account.characters ?? [],
  }));
}

function selectedWowAccount(profile: BlizzardWowProfile, wowAccountId: string): BlizzardWowAccount | null {
  return (profile.wow_accounts ?? []).find((account) => String(account.id) === wowAccountId) ?? null;
}

async function reconcileIdentityCharacters(
  client: PoolClient,
  input: { identityId: string; region: Region; account: BlizzardWowAccount },
): Promise<void> {
  await client.query(
    `UPDATE controlled_character_roster
        SET currently_controlled = false
      WHERE identity_id = $1
        AND currently_controlled = true`,
    [input.identityId],
  );

  for (const character of input.account.characters ?? []) {
    const observed = await client.query<{ character_record_id: string }>(
      `INSERT INTO character_roster (
         region, realm_id, character_id, name, realm_name, realm_slug, level, faction
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (region, realm_id, character_id) DO UPDATE SET
         name = EXCLUDED.name,
         realm_name = EXCLUDED.realm_name,
         realm_slug = EXCLUDED.realm_slug,
         level = EXCLUDED.level,
         faction = EXCLUDED.faction,
         last_seen_at = now()
       RETURNING character_record_id`,
      [
        input.region, String(character.realm.id), String(character.id),
        character.name, localizedValue(character.realm.name), character.realm.slug ?? null,
        character.level ?? null, factionValue(character.faction),
      ],
    );
    const characterRecordId = observed.rows[0]?.character_record_id;
    if (!characterRecordId) throw new Error("Observed Blizzard Character was not persisted");

    const controlledElsewhere = await client.query<{ identity_id: string }>(
      `SELECT identity_id
         FROM controlled_character_roster
        WHERE character_record_id = $1
          AND currently_controlled = true
          AND identity_id <> $2`,
      [characterRecordId, input.identityId],
    );
    if (controlledElsewhere.rowCount) {
      throw new Error("Blizzard Character coordinate is already controlled by another Identity");
    }

    await client.query(
      `INSERT INTO controlled_character_roster (
         identity_id, character_record_id, currently_controlled
       ) VALUES ($1,$2,true)
       ON CONFLICT (identity_id, character_record_id) DO UPDATE SET
         currently_controlled = true,
         last_seen_at = now()`,
      [input.identityId, characterRecordId],
    );
  }
}

export async function establishOrResolveWowAccountIdentity(input: {
  region: Region;
  wowAccountId: string;
  profile: BlizzardWowProfile;
}): Promise<string> {
  const account = selectedWowAccount(input.profile, input.wowAccountId);
  if (!account) throw new Error("Selected WoW Account is not present in the authenticated Blizzard profile");

  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.region}:${input.wowAccountId}`]);
    const existing = await client.query<{ identity_id: string }>(
      "SELECT identity_id FROM wow_account_identities WHERE region = $1 AND wow_account_id = $2",
      [input.region, input.wowAccountId],
    );

    let identityId = existing.rows[0]?.identity_id;
    if (!identityId) {
      const created = await client.query<{ identity_id: string }>(
        "INSERT INTO identities DEFAULT VALUES RETURNING identity_id",
      );
      identityId = created.rows[0].identity_id;
      await client.query(
        "INSERT INTO wow_account_identities (identity_id, region, wow_account_id) VALUES ($1,$2,$3)",
        [identityId, input.region, input.wowAccountId],
      );
    } else {
      await client.query("UPDATE wow_account_identities SET last_seen_at = now() WHERE identity_id = $1", [identityId]);
    }

    await reconcileIdentityCharacters(client, { identityId, region: input.region, account });
    return identityId;
  });
}

export async function reconcileExistingWowAccountIdentity(input: {
  identityId: string;
  region: Region;
  profile: BlizzardWowProfile;
}): Promise<void> {
  await withTransaction(async (client) => {
    const backing = await client.query<{ wow_account_id: string }>(
      "SELECT wow_account_id FROM wow_account_identities WHERE identity_id = $1 AND region = $2",
      [input.identityId, input.region],
    );
    const wowAccountId = backing.rows[0]?.wow_account_id;
    if (!wowAccountId) throw new Error("Identity is not backed by a WoW Account in the authenticated region");
    const account = selectedWowAccount(input.profile, wowAccountId);
    if (!account) throw new Error("Authenticated Blizzard principal no longer demonstrates control of the occupied WoW Account");
    await client.query("UPDATE wow_account_identities SET last_seen_at = now() WHERE identity_id = $1", [input.identityId]);
    await reconcileIdentityCharacters(client, { identityId: input.identityId, region: input.region, account });
  });
}
