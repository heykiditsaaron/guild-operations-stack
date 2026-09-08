import type { FastifyInstance, FastifyRequest } from "fastify";
import { characterMembership, guildieState } from "./application-state.js";
import { config, parseRegion } from "./config.js";

function authorized(request: FastifyRequest): boolean {
  const configured = process.env.EVENT_QUERY_API_KEY;
  if (!configured) return false;
  const header = request.headers.authorization;
  return header === configured || header === `Bearer ${configured}`;
}

export async function registerQueryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/query/guildies/:guildieId", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

    const params = request.params as { guildieId?: unknown };
    if (typeof params.guildieId !== "string" || !params.guildieId) {
      return reply.code(400).send({ error: "invalid_guildie_coordinate" });
    }

    const state = await guildieState(params.guildieId);
    if (!state) return reply.code(404).send({ error: "guildie_not_found" });

    return reply.send({
      guildie_id: state.guildieId,
      discord: state.discordAssociation
        ? {
            discord_user_id: state.discordAssociation.discordUserId,
            username: state.discordAssociation.username,
            connected_at: state.discordAssociation.connectedAt,
          }
        : null,
      guild: {
        membership: state.guildAuthority
          ? {
              guild_id: state.guildAuthority.guildId,
              rank: state.guildAuthority.rankIndex,
              rank_name: state.guildAuthority.rankDisplayName,
            }
          : null,
        main_character: state.selectedMain
          ? {
              guild_id: state.selectedMain.guildId,
              character_id: state.selectedMain.characterId,
              realm_id: state.selectedMain.realmId,
              name: state.selectedMain.name,
              realm_name: state.selectedMain.realmName,
              rank: state.selectedMain.rankIndex,
              currently_eligible: state.selectedMain.currentlyEligible,
              avatar_url: state.selectedMain.avatarUrl,
            }
          : null,
      },
    });
  });

  app.get("/query/guilds/:guildId/character-members/:region/:realmId/:characterId", async (request, reply) => {
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

    const membership = await characterMembership({
      guildId: params.guildId,
      region,
      realmId: params.realmId,
      characterId: params.characterId,
    });

    return reply.send({
      guild_id: params.guildId,
      region,
      realm_id: params.realmId,
      character_id: params.characterId,
      membership: membership
        ? {
            currently_present: membership.currentlyPresent,
            rank: membership.rankIndex,
            character_name: membership.characterName,
            realm_name: membership.realmName,
            realm_slug: membership.realmSlug,
          }
        : null,
    });
  });
}
