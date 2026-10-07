import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../auth.js";
import { pool } from "../../db.js";
import { installationAbsoluteUrl } from "../../core/installation/public-origin.js";
import { discordIntegrationConfiguration } from "./configuration.js";
import { currentDiscordUser, exchangeDiscordAuthorizationCode } from "./api.js";
import { associateIdentityWithWowAccount, establishDiscordIdentity } from "./identity.js";

function stateHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function registerDiscordOAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/integrations/discord/oauth/start", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });
    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.applicationVerifiedAt) {
      return reply.code(409).send({ error: "discord_integration_not_ready" });
    }
    const state = randomBytes(32).toString("base64url");
    await pool.query(
      "INSERT INTO discord_oauth_attempts (state_hash, wow_identity_id, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [stateHash(state), identity.identityId],
    );
    const redirectUri = await installationAbsoluteUrl("/integrations/discord/oauth/callback");
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", configuration.applicationId);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", redirectUri);
    return reply.redirect(url.toString());
  });

  app.get("/integrations/discord/oauth/callback", async (request, reply) => {
    const query = request.query as { state?: unknown; code?: unknown; error?: unknown };
    if (typeof query.state !== "string") return reply.code(400).send({ error: "invalid_oauth_callback" });
    const attempt = await pool.query<{ wow_identity_id: string }>(
      "UPDATE discord_oauth_attempts SET consumed_at = now() WHERE state_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING wow_identity_id",
      [stateHash(query.state)],
    );
    const wowIdentityId = attempt.rows[0]?.wow_identity_id;
    if (!wowIdentityId) return reply.code(400).send({ error: "invalid_or_expired_state" });

    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity || identity.identityId !== wowIdentityId) return reply.code(401).send({ error: "identity_changed_during_oauth" });
    if (typeof query.error === "string") return reply.redirect("/me?discord=cancelled");
    if (typeof query.code !== "string") return reply.code(400).send({ error: "invalid_oauth_callback" });

    const configuration = await discordIntegrationConfiguration();
    if (!configuration?.enabled || !configuration.applicationVerifiedAt) return reply.code(409).send({ error: "discord_integration_not_ready" });

    try {
      const redirectUri = await installationAbsoluteUrl("/integrations/discord/oauth/callback");
      const accessToken = await exchangeDiscordAuthorizationCode({ configuration, code: query.code, redirectUri });
      const discordUser = await currentDiscordUser(accessToken);
      const discordIdentityId = await establishDiscordIdentity({
        discordUserId: discordUser.id,
        username: discordUser.global_name || discordUser.username,
      });
      await associateIdentityWithWowAccount({ externalIdentityId: discordIdentityId, wowIdentityId });
      return reply.redirect("/me?discord=connected");
    } catch (error) {
      request.log.error({ err: error }, "Discord identity association failed");
      return reply.redirect("/me?discord=failed");
    }
  });
}
