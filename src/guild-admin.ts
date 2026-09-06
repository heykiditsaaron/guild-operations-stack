import { config } from "./config.js";
import { pool } from "./db.js";

export type GuildRefreshStatus = {
  guildId: string;
  guildName: string;
  currentMemberCount: number;
  lastReconciledAtUnix: number;
};

export async function guildRefreshStatus(): Promise<GuildRefreshStatus | null> {
  const result = await pool.query<{
    guild_id: string;
    guild_name: string;
    current_member_count: number;
    last_reconciled_at_unix: string;
  }>(
    `SELECT
       g.guild_id,
       g.name AS guild_name,
       COUNT(grm.character_id)::integer AS current_member_count,
       FLOOR(EXTRACT(EPOCH FROM g.last_seen_at))::bigint AS last_reconciled_at_unix
     FROM guilds g
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = g.guild_id
      AND grm.currently_present = true
     WHERE g.guild_id = $1
     GROUP BY g.guild_id, g.name, g.last_seen_at`,
    [config.guild.id],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    guildId: row.guild_id,
    guildName: row.guild_name,
    currentMemberCount: row.current_member_count,
    lastReconciledAtUnix: Number(row.last_reconciled_at_unix),
  };
}
