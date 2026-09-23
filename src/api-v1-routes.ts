import type { FastifyInstance, FastifyRequest } from "fastify";
import { characterMembership } from "./core/guild/character-membership.js";
import { effectiveGuildAuthority } from "./core/authority/guild-permissions.js";
import { mainCharacterForGuildie } from "./core/identity/main-character.js";
import { guildieExists } from "./core/identity/guildie.js";
import { guildCharactersForGuildie } from "./core/guild/guild-characters.js";
import { config, parseRegion } from "./config.js";

function readAuthorized(request: FastifyRequest): boolean {
  const configured = process.env.API_READ_KEY;
  if (!configured) return false;
  const header = request.headers.authorization;
  return header === configured || header === `Bearer ${configured}`;
}

export async function registerApiV1Routes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/guildies/:guildieId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

    const params = request.params as { guildieId?: unknown };
    if (typeof params.guildieId !== "string" || !params.guildieId) {
      return reply.code(400).send({ error: "invalid_guildie_coordinate" });
    }

    const exists = await guildieExists(params.guildieId);
    if (!exists) return reply.code(404).send({ error: "guildie_not_found" });

    const [selectedMain, guildAuthority] = await Promise.all([
      mainCharacterForGuildie(params.guildieId),
      effectiveGuildAuthority(params.guildieId),
    ]);

    return reply.send({
      guildie_id: params.guildieId,
      guild: {
        membership: guildAuthority
          ? {
              guild_id: guildAuthority.guildId,
              rank: guildAuthority.rankIndex,
              rank_name: guildAuthority.rankDisplayName,
            }
          : null,
        main_character: selectedMain
          ? {
              guild_id: selectedMain.guildId,
              character_id: selectedMain.characterId,
              realm_id: selectedMain.realmId,
              name: selectedMain.name,
              realm_name: selectedMain.realmName,
              rank: selectedMain.rankIndex,
              currently_eligible: selectedMain.currentlyEligible,
              avatar_url: selectedMain.avatarUrl,
            }
          : null,
      },
    });
  });

  app.get(
    "/api/v1/guilds/:guildId/characters/:region/:realmId/:characterId",
    async (request, reply) => {
      if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

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
        return reply.code(400).send({ error: "invalid_character_coordinate" });
      }
      const region = parseRegion(params.region);
      if (!region) return reply.code(400).send({ error: "invalid_character_coordinate" });
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
    },
  );


}
