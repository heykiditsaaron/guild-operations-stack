import { config } from "../../config.js";
import { pool, withTransaction } from "../../db.js";
import {
  RAID_CREATE_CAPABILITY,
  RAID_MANAGE_CAPABILITY,
  RAID_PERMISSIONS_CAPABILITY,
  requireGuildCapabilityOrOperator,
} from "../../guild-permissions.js";

export type RaidRankPermission = {
  rankIndex: number;
  displayName: string;
  active: boolean;
  canCreate: boolean;
  canManage: boolean;
};

export type RaidRankPermissionUpdate = {
  rankIndex: number;
  canCreate: boolean;
  canManage: boolean;
};

export async function raidRankPermissions(): Promise<RaidRankPermission[]> {
  const result = await pool.query<{
    rank_index: number;
    display_name: string | null;
    active: boolean;
    can_create: boolean;
    can_manage: boolean;
  }>(
    `SELECT
       grd.rank_index,
       grd.display_name,
       grd.active,
       bool_or(grc.capability = $2) AS can_create,
       bool_or(grc.capability = $3) AS can_manage
     FROM guild_rank_definitions grd
     LEFT JOIN guild_rank_capabilities grc
       ON grc.guild_id = grd.guild_id
      AND grc.rank_index = grd.rank_index
      AND grc.capability IN ($2, $3)
     WHERE grd.guild_id = $1
     GROUP BY grd.rank_index, grd.display_name, grd.active
     ORDER BY grd.rank_index`,
    [config.guild.id, RAID_CREATE_CAPABILITY, RAID_MANAGE_CAPABILITY],
  );

  return result.rows.map((row) => ({
    rankIndex: row.rank_index,
    displayName: row.display_name ?? `Rank ${row.rank_index}`,
    active: row.active,
    canCreate: row.can_create,
    canManage: row.can_manage,
  }));
}

export async function setRaidRankPermissions(
  actorGuildieId: string,
  updates: readonly RaidRankPermissionUpdate[],
): Promise<void> {
  await requireGuildCapabilityOrOperator(actorGuildieId, RAID_PERMISSIONS_CAPABILITY);

  const normalized = [...new Map(updates.map((update) => [update.rankIndex, update])).values()];
  if (normalized.some((update) => !Number.isInteger(update.rankIndex) || update.rankIndex < 0)) {
    throw new Error("Raid permission rank is invalid");
  }

  await withTransaction(async (client) => {
    const rankResult = await client.query<{ rank_index: number }>(
      `SELECT rank_index
         FROM guild_rank_definitions
        WHERE guild_id = $1`,
      [config.guild.id],
    );
    const knownRanks = new Set(rankResult.rows.map((row) => row.rank_index));
    if (normalized.some((update) => !knownRanks.has(update.rankIndex))) {
      throw new Error("Raid permission update referenced an unknown guild rank");
    }

    for (const update of normalized) {
      for (const [capability, enabled] of [
        [RAID_CREATE_CAPABILITY, update.canCreate],
        [RAID_MANAGE_CAPABILITY, update.canManage],
      ] as const) {
        if (enabled) {
          await client.query(
            `INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
             VALUES ($1, $2, $3)
             ON CONFLICT (guild_id, rank_index, capability) DO NOTHING`,
            [config.guild.id, update.rankIndex, capability],
          );
        } else {
          await client.query(
            `DELETE FROM guild_rank_capabilities
              WHERE guild_id = $1
                AND rank_index = $2
                AND capability = $3`,
            [config.guild.id, update.rankIndex, capability],
          );
        }
      }
    }
  });
}
