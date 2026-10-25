import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { parseRegion } from "../../config.js";
import {
  authorizeInstallationGuildBinding,
  establishPendingInstallationGuildBinding,
  installationGuildBinding,
} from "./guild-binding.js";
import { discoverInstallationGuildCandidates } from "./guild-candidates.js";
import { withTransaction } from "../../db.js";
import { validSetupAuthorization } from "./setup-authorization.js";

export async function registerInstallationRoutes(
  app: FastifyInstance,
  options: { onOperational?: () => void | Promise<void> } = {},
): Promise<void> {
  app.post("/installation/restart", async (request, reply) => {
    if (!validSetupAuthorization(request.headers["x-setup-authorization"])) return reply.code(403).send({ error: "setup_authorization_required" });
    const binding = await installationGuildBinding();
    if (binding?.authorizedAt) {
      return reply.code(409).send({ error: "operational_installation_cannot_restart_setup" });
    }

    await withTransaction(async (client) => {
      await client.query("DELETE FROM installation_guild_binding WHERE singleton = true");
      await client.query("DELETE FROM installation_blizzard_configuration WHERE singleton = true");
      await client.query("DELETE FROM installation_web_configuration WHERE singleton = true");
      await client.query("DELETE FROM authentication_attempts");
      await client.query("UPDATE application_sessions SET revoked_at = now() WHERE revoked_at IS NULL");
    });
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/installation", async (request, reply) => {
    const binding = await installationGuildBinding();
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) {
      return reply.send({
        state: binding?.authorizedAt ? "operational" : binding ? "pending_authorization" : "unbound",
        authenticated: false,
        binding,
      });
    }

    const candidates = binding ? [] : await discoverInstallationGuildCandidates(identity.identityId);
    return reply.send({
      state: binding?.authorizedAt ? "operational" : binding ? "pending_authorization" : "unbound",
      authenticated: true,
      identity_id: identity.identityId,
      binding,
      candidates,
    });
  });

  app.post("/installation/guild", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });

    const body = request.body as { region?: unknown; guild_id?: unknown } | null;
    const region = parseRegion(body?.region);
    if (!region || typeof body?.guild_id !== "string" || !body.guild_id.trim()) {
      return reply.code(400).send({ error: "invalid_guild_candidate" });
    }

    try {
      const binding = await establishPendingInstallationGuildBinding({
        identityId: identity.identityId,
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
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });

    try {
      const binding = await authorizeInstallationGuildBinding(identity.identityId);
      await options.onOperational?.();
      return reply.send({ state: "operational", binding });
    } catch (error) {
      request.log.warn({ err: error }, "Installation guild authorization was not established");
      return reply.code(403).send({ error: "installation_authorization_required" });
    }
  });
}
