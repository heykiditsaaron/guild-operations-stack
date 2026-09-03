import type { FastifyInstance, FastifyRequest } from "fastify";
import { config, parseRegion } from "../config.js";
import { pool } from "../db.js";
import { discordAssociationForSubject } from "../discord.js";
import { effectiveGuildAuthority } from "../guild-permissions.js";
import { mainCharacterForSubject } from "../main-character.js";

function authorized(request: FastifyRequest): boolean {
  const configured = process.env.EVENT_QUERY_API_KEY;
  if (!configured) return false;
  const header = request.headers.authorization;
  return header === configured || header === `Bearer ${configured}`;
}

export async function registerEventQueryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/events/query/subjects/:subjectId", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

    const params = request.params as { subjectId?: unknown };
    if (typeof params.subjectId !== "string" || !params.subjectId) {
      return reply.code(400).send({ error: "invalid_subject_coordinate" });
    }

    const subject = await pool.query<{ subject_id: string }>(
      "SELECT subject_id FROM guild_subjects WHERE subject_id = $1",
      [params.subjectId],
    );
    if (!subject.rowCount) return reply.code(404).send({ error: "subject_not_found" });

    const [discord, main, membership] = await Promise.all([
      discordAssociationForSubject(params.subjectId),
      mainCharacterForSubject(params.subjectId),
      effectiveGuildAuthority(params.subjectId),
    ]);

    return reply.send({
      subject_id: params.subjectId,
      discord: discord
        ? {
            discord_user_id: discord.discordUserId,
            username: discord.username,
            connected_at: discord.connectedAt,
          }
        : null,
      guild: {
        membership: membership
          ? {
              guild_id: membership.guildId,
              rank: membership.rankIndex,
              rank_name: membership.rankDisplayName,
            }
          : null,
        main_character: main
          ? {
              guild_id: main.guildId,
              character_id: main.characterId,
              realm_id: main.realmId,
              name: main.name,
              realm_name: main.realmName,
              rank: main.rankIndex,
              currently_eligible: main.currentlyEligible,
              avatar_url: main.avatarUrl,
            }
          : null,
      },
    });
  });

  app.get("/events/query/guilds/:guildId/character-members/:region/:realmId/:characterId", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

    const params = request.params as {
      guildId?: unknown;
      region?: unknown;
      realmId?: unknown;
      characterId?: unknown;
    };
    if (
      typeof params.guildId !== "string" || !params.guildId ||
      typeof params.realmId !== "string" || !params.realmId ||
      typeof params.characterId !== "string" || !params.characterId
    ) {
      return reply.code(400).send({ error: "invalid_character_membership_coordinate" });
    }
    const region = parseRegion(params.region);
    if (!region) return reply.code(400).send({ error: "invalid_character_membership_coordinate" });
    if (params.guildId !== config.guild.id) return reply.code(404).send({ error: "guild_not_found" });

    const result = await pool.query<{
      rank_index: number;
      character_name: string;
      realm_name: string | null;
      realm_slug: string | null;
    }>(
      `SELECT rank_index, character_name, realm_name, realm_slug
         FROM guild_roster_memberships
        WHERE guild_id = $1
          AND region = $2
          AND realm_id = $3
          AND character_id = $4
          AND currently_present = true`,
      [params.guildId, region, params.realmId, params.characterId],
    );
    const membership = result.rows[0];

    return reply.send({
      guild_id: params.guildId,
      region,
      realm_id: params.realmId,
      character_id: params.characterId,
      membership: membership
        ? {
            currently_present: true,
            rank: membership.rank_index,
            character_name: membership.character_name,
            realm_name: membership.realm_name,
            realm_slug: membership.realm_slug,
          }
        : null,
    });
  });
}
