import type { FastifyInstance, FastifyRequest } from "fastify";
import { pool } from "../db.js";
import { discordAssociationForSubject } from "../discord.js";
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

    const [discord, main] = await Promise.all([
      discordAssociationForSubject(params.subjectId),
      mainCharacterForSubject(params.subjectId),
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
}
