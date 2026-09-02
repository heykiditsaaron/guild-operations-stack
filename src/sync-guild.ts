import { refreshGuildAuthority } from "./guild.js";
import { pool } from "./db.js";

try {
  const result = await refreshGuildAuthority();
  console.log(JSON.stringify({
    guild_id: result.guildId,
    roster_count: result.rosterCount,
    reconciliation: {
      characters_targeted: result.reconciliation.charactersTargeted,
      profiles_updated: result.reconciliation.profilesUpdated,
      media_updated: result.reconciliation.mediaUpdated,
      failed_profiles: result.reconciliation.failedProfiles,
      failed_media: result.reconciliation.failedMedia,
      api_calls: result.reconciliation.apiCalls,
    },
  }, null, 2));
} finally {
  await pool.end();
}
