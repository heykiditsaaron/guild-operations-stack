import { pool, withTransaction } from "../../db.js";

export type DiscordRankRoleMapping = {
  rankIndex: number;
  discordRoleId: string;
};

export async function discordRankRoleMappings(guildId: string): Promise<DiscordRankRoleMapping[]> {
  const result = await pool.query<{ rank_index: number; discord_role_id: string }>(
    "SELECT rank_index, discord_role_id FROM discord_rank_role_mappings WHERE guild_id = $1 ORDER BY rank_index",
    [guildId],
  );
  return result.rows.map((row) => ({ rankIndex: row.rank_index, discordRoleId: row.discord_role_id }));
}

export async function managedDiscordRankRoleIds(discordGuildId: string): Promise<string[]> {
  const result = await pool.query<{ discord_role_id: string }>(
    "SELECT discord_role_id FROM discord_rank_role_managed WHERE discord_guild_id = $1",
    [discordGuildId],
  );
  return result.rows.map((row) => row.discord_role_id);
}

/**
 * Replace the customer's rank mappings atomically. Previously managed roles
 * remain in the managed scope so reconciliation can remove obsolete grants.
 * Never treat roles outside this scope as Guild Operations-owned.
 */
export async function replaceDiscordRankRoleMappings(input: {
  guildId: string;
  boundAt: Date;
  discordGuildId: string;
  mappings: DiscordRankRoleMapping[];
}): Promise<void> {
  const ranks = new Set<number>();
  const roles = new Set<string>();
  for (const mapping of input.mappings) {
    if (!Number.isSafeInteger(mapping.rankIndex) || mapping.rankIndex < 0 ||
      !/^\d+$/.test(mapping.discordRoleId) ||
      ranks.has(mapping.rankIndex) || roles.has(mapping.discordRoleId)) {
      throw new Error("invalid_discord_rank_role_mapping");
    }
    ranks.add(mapping.rankIndex);
    roles.add(mapping.discordRoleId);
  }

  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock_shared(256, 1)");
    const binding = await client.query<{ guild_id: string; bound_at: Date }>(
      "SELECT guild_id, bound_at FROM installation_guild_binding WHERE singleton = true",
    );
    if (binding.rows[0]?.guild_id !== input.guildId ||
      binding.rows[0]?.bound_at.getTime() !== input.boundAt.getTime()) {
      throw new Error("discord_guild_binding_changed");
    }
    const configuredServer = await client.query<{ discord_guild_id: string | null }>(
      "SELECT discord_guild_id FROM discord_integration_configuration WHERE singleton = true AND enabled = true",
    );
    if (configuredServer.rows[0]?.discord_guild_id !== input.discordGuildId) {
      throw new Error("discord_server_binding_changed");
    }
    const defined = await client.query<{ rank_index: number }>(
      "SELECT rank_index FROM guild_rank_definitions WHERE guild_id = $1 AND active = true",
      [input.guildId],
    );
    const allowedRanks = new Set(defined.rows.map((row) => row.rank_index));
    if (input.mappings.some((mapping) => !allowedRanks.has(mapping.rankIndex))) {
      throw new Error("invalid_discord_rank_role_mapping");
    }

    await client.query("DELETE FROM discord_rank_role_mappings WHERE guild_id = $1", [input.guildId]);
    for (const mapping of input.mappings) {
      await client.query(
        "INSERT INTO discord_rank_role_mappings (guild_id, rank_index, discord_role_id) VALUES ($1, $2, $3)",
        [input.guildId, mapping.rankIndex, mapping.discordRoleId],
      );
      await client.query(
        "INSERT INTO discord_rank_role_managed (discord_guild_id, discord_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [input.discordGuildId, mapping.discordRoleId],
      );
    }
  });
}
