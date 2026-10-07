import { withTransaction } from "../../db.js";

export async function establishDiscordIdentity(input: {
  discordUserId: string;
  username?: string | null;
}): Promise<string> {
  const discordUserId = input.discordUserId.trim();
  if (!discordUserId) throw new Error("invalid_discord_identity");
  const username = input.username?.trim() || null;

  return withTransaction(async (client) => {
    const existing = await client.query<{ identity_id: string }>(
      "SELECT identity_id FROM discord_identities WHERE discord_user_id = $1",
      [discordUserId],
    );
    const identityId = existing.rows[0]?.identity_id;
    if (identityId) {
      await client.query(
        "UPDATE discord_identities SET username = $2, last_seen_at = now() WHERE identity_id = $1",
        [identityId, username],
      );
      return identityId;
    }

    const identity = await client.query<{ identity_id: string }>(
      "INSERT INTO identities DEFAULT VALUES RETURNING identity_id",
    );
    const establishedIdentityId = identity.rows[0]?.identity_id;
    if (!establishedIdentityId) throw new Error("Discord Identity was not established");
    await client.query(
      "INSERT INTO discord_identities (identity_id, discord_user_id, username) VALUES ($1, $2, $3)",
      [establishedIdentityId, discordUserId, username],
    );
    return establishedIdentityId;
  });
}

export async function associateIdentityWithWowAccount(input: {
  externalIdentityId: string;
  wowIdentityId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const discord = await client.query("SELECT 1 FROM discord_identities WHERE identity_id = $1", [input.externalIdentityId]);
    if ((discord.rowCount ?? 0) === 0) throw new Error("external_identity_not_discord");
    const wow = await client.query("SELECT 1 FROM wow_account_identities WHERE identity_id = $1", [input.wowIdentityId]);
    if ((wow.rowCount ?? 0) === 0) throw new Error("wow_identity_not_found");
    await client.query(
      `INSERT INTO identity_wow_associations (external_identity_id, wow_identity_id)
       VALUES ($1, $2)
       ON CONFLICT (external_identity_id) DO UPDATE SET
         wow_identity_id = EXCLUDED.wow_identity_id,
         established_at = now()`,
      [input.externalIdentityId, input.wowIdentityId],
    );
  });
}

export async function resolvedActorSubjectForDiscordIdentity(discordIdentityId: string): Promise<string> {
  const { pool } = await import("../../db.js");
  const result = await pool.query<{ wow_identity_id: string }>(
    "SELECT wow_identity_id FROM identity_wow_associations WHERE external_identity_id = $1",
    [discordIdentityId],
  );
  return result.rows[0]?.wow_identity_id ?? discordIdentityId;
}
