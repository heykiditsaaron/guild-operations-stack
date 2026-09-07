import { pool } from "../db.js";
import { getDiscordGuildMember } from "./client.js";

export type GuildieDiscordState = {
  guildieId: string;
  associated: boolean;
  discordUserId: string | null;
  presentInGuild: boolean;
  roleIds: string[];
  observedAt: number;
};

async function associatedDiscordUserId(guildieId: string): Promise<string | null> {
  const result = await pool.query<{ discord_user_id: string }>(
    "SELECT discord_user_id FROM discord_associations WHERE guildie_id = $1",
    [guildieId],
  );
  return result.rows[0]?.discord_user_id ?? null;
}

export async function discordStateForGuildie(guildieId: string): Promise<GuildieDiscordState> {
  const discordUserId = await associatedDiscordUserId(guildieId);
  const observedAt = Math.floor(Date.now() / 1000);

  if (!discordUserId) {
    return {
      guildieId,
      associated: false,
      discordUserId: null,
      presentInGuild: false,
      roleIds: [],
      observedAt,
    };
  }

  const member = await getDiscordGuildMember(discordUserId);
  return {
    guildieId,
    associated: true,
    discordUserId,
    presentInGuild: Boolean(member),
    roleIds: member?.roleIds ?? [],
    observedAt,
  };
}
