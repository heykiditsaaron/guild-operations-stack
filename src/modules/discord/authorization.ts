import { pool } from "../../db.js";
import type { EffectiveGuildAuthority } from "../../guild-permissions.js";

export const DISCORD_ADMIN_CAPABILITY = "guild.discord.manage";

export function discordAuthorityCanAdminister(authority: EffectiveGuildAuthority): boolean {
  return authority.capabilities.includes(DISCORD_ADMIN_CAPABILITY);
}

export async function ensureDiscordAdministrationCapabilities(guildId: string): Promise<void> {
  await pool.query(
    `INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
     SELECT guild_id, rank_index, $2
       FROM guild_rank_definitions
      WHERE guild_id = $1
        AND active = true
        AND rank_index IN (0, 1, 2)
     ON CONFLICT (guild_id, rank_index, capability) DO NOTHING`,
    [guildId, DISCORD_ADMIN_CAPABILITY],
  );
}
