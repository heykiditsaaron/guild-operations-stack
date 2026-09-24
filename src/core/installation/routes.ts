import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { parseRegion } from "../../config.js";
import {
  authorizeInstallationGuildBinding,
  establishPendingInstallationGuildBinding,
  installationGuildBinding,
} from "./guild-binding.js";
import { discoverInstallationGuildCandidates } from "./guild-candidates.js";
import {
  installationBlizzardConfigured,
  storeInstallationBlizzardConfiguration,
  validateBlizzardApplicationCredentials,
} from "./blizzard-configuration.js";

export async function registerInstallationRoutes(
  app: FastifyInstance,
  options: { onOperational?: () => void | Promise<void> } = {},
): Promise<void> {
  app.post("/installation/blizzard", async (request, reply) => {
    if (await installationBlizzardConfigured()) {
      return reply.code(409).send({ error: "blizzard_already_configured" });
    }
    const body = request.body as { client_id?: unknown; client_secret?: unknown } | null;
    const clientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
    const clientSecret = typeof body?.client_secret === "string" ? body.client_secret.trim() : "";
    if (!clientId || !clientSecret) {
      return reply.code(400).send({ error: "invalid_blizzard_configuration" });
    }
    if (!await validateBlizzardApplicationCredentials({ clientId, clientSecret })) {
      return reply.code(400).send({ error: "blizzard_credentials_rejected" });
    }
    await storeInstallationBlizzardConfiguration({ clientId, clientSecret });
    return reply.code(201).send({ configured: true });
  });

  app.get("/installation", async (request, reply) => {
    const binding = await installationGuildBinding();
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) {
      return reply.send({
        state: binding?.authorizedAt ? "operational" : binding ? "pending_authorization" : "unbound",
        authenticated: false,
        binding,
      });
    }

    const candidates = binding ? [] : await discoverInstallationGuildCandidates(guildie.guildieId);
    return reply.send({
      state: binding?.authorizedAt ? "operational" : binding ? "pending_authorization" : "unbound",
      authenticated: true,
      guildie_id: guildie.guildieId,
      binding,
      candidates,
    });
  });

  app.post("/installation/guild", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    const body = request.body as { region?: unknown; guild_id?: unknown } | null;
    const region = parseRegion(body?.region);
    if (!region || typeof body?.guild_id !== "string" || !body.guild_id.trim()) {
      return reply.code(400).send({ error: "invalid_guild_candidate" });
    }

    try {
      const binding = await establishPendingInstallationGuildBinding({
        guildieId: guildie.guildieId,
        region,
        guildId: body.guild_id.trim(),
      });
      return reply.code(201).send({ state: "pending_authorization", binding });
    } catch (error) {
      request.log.warn({ err: error }, "Installation guild binding was not established");
      return reply.code(409).send({ error: "guild_binding_not_established" });
    }
  });

  app.post("/installation/authorize", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    try {
      const binding = await authorizeInstallationGuildBinding(guildie.guildieId);
      await options.onOperational?.();
      return reply.send({ state: "operational", binding });
    } catch (error) {
      request.log.warn({ err: error }, "Installation guild authorization was not established");
      return reply.code(403).send({ error: "installation_authorization_required" });
    }
  });
}
