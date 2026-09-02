import { refreshGuildAuthority } from "./guild.js";
import { pool } from "./db.js";

try {
  const result = await refreshGuildAuthority();
  console.log(JSON.stringify({
    guild_id: result.guildId,
    roster_count: result.rosterCount,
  }, null, 2));
} finally {
  await pool.end();
}
