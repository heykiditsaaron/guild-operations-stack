import { pool } from "./db.js";
import { performGuildRefresh } from "./guild-refresh-operation.js";

try {
  const result = await performGuildRefresh();
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
      failures: result.reconciliation.failures.map((failure) => ({
        character_id: failure.characterId,
        realm_id: failure.realmId,
        name: failure.name,
        stage: failure.stage,
        error: failure.error,
      })),
    },
  }, null, 2));
} finally {
  await pool.end();
}
