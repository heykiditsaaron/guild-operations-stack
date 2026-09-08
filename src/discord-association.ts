import { pool } from "./db.js";

export type DiscordAssociation = {
  discordUserId: string;
  username: string;
  connectedAt: Date;
};

export type DiscordAssociationInput = {
  discordUserId: string;
  username: string;
};

export type DiscordAssociationResult = "established" | "already_associated" | "conflict";

export async function discordAssociationForGuildie(guildieId: string): Promise<DiscordAssociation | null> {
  const result = await pool.query<{
    discord_user_id: string;
    username: string;
    connected_at: Date;
  }>(
    `SELECT discord_user_id, username, connected_at
       FROM discord_associations
      WHERE guildie_id = $1`,
    [guildieId],
  );
  if (!result.rowCount) return null;
  return {
    discordUserId: result.rows[0].discord_user_id,
    username: result.rows[0].username,
    connectedAt: result.rows[0].connected_at,
  };
}

export async function establishDiscordAssociation(
  guildieId: string,
  input: DiscordAssociationInput,
): Promise<DiscordAssociationResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ guildie_id: string; discord_user_id: string }>(
      `SELECT guildie_id, discord_user_id
         FROM discord_associations
        WHERE guildie_id = $1 OR discord_user_id = $2
        FOR UPDATE`,
      [guildieId, input.discordUserId],
    );

    if (existing.rowCount) {
      const same = existing.rows.find(
        (row) => row.guildie_id === guildieId && row.discord_user_id === input.discordUserId,
      );
      if (!same || existing.rows.length !== 1) {
        await client.query("ROLLBACK");
        return "conflict";
      }

      await client.query(
        "UPDATE discord_associations SET username = $1 WHERE guildie_id = $2",
        [input.username, guildieId],
      );
      await client.query("COMMIT");
      return "already_associated";
    }

    try {
      await client.query(
        `INSERT INTO discord_associations (guildie_id, discord_user_id, username)
         VALUES ($1, $2, $3)`,
        [guildieId, input.discordUserId, input.username],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        await client.query("ROLLBACK");
        return "conflict";
      }
      throw error;
    }

    await client.query("COMMIT");
    return "established";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeDiscordAssociation(guildieId: string): Promise<string | null> {
  const deleted = await pool.query<{ discord_user_id: string }>(
    "DELETE FROM discord_associations WHERE guildie_id = $1 RETURNING discord_user_id",
    [guildieId],
  );
  return deleted.rows[0]?.discord_user_id ?? null;
}
