import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
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
import { establishInstallationPublicOrigin, installationPublicOrigin, normalizeOrigin, publicOriginForRequest, relocateInstallationPublicOrigin } from "./public-origin.js";
import { effectiveGuildAuthority } from "../authority/guild-permissions.js";
import { withTransaction } from "../../db.js";
import { validSetupAuthorization } from "./setup-authorization.js";

export async function registerInstallationRoutes(
  app: FastifyInstance,
  options: { onOperational?: () => void | Promise<void> } = {},
): Promise<void> {
  // Relocation is restricted to the Blizzard-authoritative guild master.
  // A same-origin JSON request prevents a cross-site form from changing the callback host.
  app.put("/installation/public-origin", async (request, reply) => {
    const setupAuthorized = validSetupAuthorization(request.headers["x-setup-authorization"]);
    if (!setupAuthorized) {
      const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
      if (!identity) return reply.code(401).send({ error: "authentication_required" });
      const authority = await effectiveGuildAuthority(identity.identityId);
      if (!authority || authority.rankIndex !== 0) return reply.code(403).send({ error: "guild_master_required" });
    }

    const current = await installationPublicOrigin();
    if (!current) return reply.code(409).send({ error: "public_origin_not_established" });
    if ((!setupAuthorized && request.headers.origin !== current) || request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      return reply.code(403).send({ error: "same_origin_json_required" });
    }

    const body = request.body as { expected_origin?: unknown; public_origin?: unknown } | null;
    if (typeof body?.expected_origin !== "string" || typeof body.public_origin !== "string") {
      return reply.code(400).send({ error: "invalid_public_origin" });
    }
    let expected: string;
    let next: string;
    try {
      expected = normalizeOrigin(body.expected_origin);
      next = normalizeOrigin(body.public_origin);
    } catch {
      return reply.code(400).send({ error: "invalid_public_origin" });
    }
    if (expected !== current) return reply.code(409).send({ error: "public_origin_changed", current });
    const updated = await relocateInstallationPublicOrigin(expected, next);
    if (!updated) return reply.code(409).send({ error: "public_origin_changed" });
    return reply.send({ public_origin: updated, previous_origin: expected, oauth_redirects_must_be_updated: true });
  });

  app.post("/installation/blizzard", async (request, reply) => {
    if (!validSetupAuthorization(request.headers["x-setup-authorization"])) return reply.code(403).send({ error: "setup_authorization_required" });
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
    await establishInstallationPublicOrigin(publicOriginForRequest(request));
    await storeInstallationBlizzardConfiguration({ clientId, clientSecret });
    return reply.code(201).send({ configured: true });
  });

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
