import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import {
  establishDiscordAssociation,
  removeDiscordAssociation,
} from "./association.js";
import {
  discordModuleRuntimeConfiguration,
  discordOAuthRedirectUri,
} from "./module-configuration.js";
import {
  reconcileGuildieDiscordRoles,
  removeManagedDiscordRolesForUser,
} from "./roles.js";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_CURRENT_USER_URL = "https://discord.com/api/v10/users/@me";

type DiscordAttempt = {
  guildieId: string;
  returnTo: string | null;
};

type DiscordUser = {
  id: string;
  username: string;
};

type DiscordOAuthConfiguration = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

class DiscordOAuthNotConfiguredError extends Error {
  constructor() {
    super("Discord OAuth is not configured");
    this.name = "DiscordOAuthNotConfiguredError";
  }
}

async function oauthConfiguration(): Promise<DiscordOAuthConfiguration> {
  const current = await discordModuleRuntimeConfiguration();
  if (!current.enabled || !current.clientId || !current.clientSecret) {
    throw new DiscordOAuthNotConfiguredError();
  }
  return {
    clientId: current.clientId,
    clientSecret: current.clientSecret,
    redirectUri: discordOAuthRedirectUri(),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function withDiscordResult(path: string, result: "connected" | "failed" | "conflict"): string {
  const url = new URL(path, config.appOrigin);
  url.searchParams.set("discord", result);
  return `${url.pathname}${url.search}${url.hash}`;
}

function authorizationUrl(state: string, oauth: DiscordOAuthConfiguration): string {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", oauth.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", oauth.redirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

async function createAttempt(guildieId: string, returnTo: string | null): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO discord_association_attempts (state_hash, guildie_id, return_to, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'))`,
    [sha256(state), guildieId, returnTo, config.authAttemptTtlMinutes],
  );
  return state;
}

async function consumeAttempt(state: string): Promise<DiscordAttempt | null> {
  const result = await pool.query<{ guildie_id: string; return_to: string | null }>(
    `UPDATE discord_association_attempts
        SET consumed_at = now()
      WHERE state_hash = $1
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING guildie_id, return_to`,
    [sha256(state)],
  );
  if (!result.rowCount) return null;
  return {
    guildieId: result.rows[0].guildie_id,
    returnTo: result.rows[0].return_to,
  };
}

async function exchangeAuthorizationCode(code: string, oauth: DiscordOAuthConfiguration): Promise<string> {
  const body = new URLSearchParams({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: oauth.redirectUri,
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Discord token exchange failed with ${response.status}`);

  const payload = await response.json() as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Discord token exchange returned no access token");
  }
  return payload.access_token;
}

async function acquireDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(DISCORD_CURRENT_USER_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Discord current-user acquisition failed with ${response.status}`);

  const payload = await response.json() as { id?: unknown; username?: unknown };
  if (typeof payload.id !== "string" || !payload.id || typeof payload.username !== "string" || !payload.username) {
    throw new Error("Discord current-user response lacked required identity fields");
  }
  return { id: payload.id, username: payload.username };
}

async function reconcileAssociationBestEffort(guildieId: string): Promise<void> {
  try {
    await reconcileGuildieDiscordRoles(guildieId, { trigger: "discord-association" });
  } catch (error) {
    console.error("Discord association role reconciliation failed", { guildieId, error });
  }
}

async function removeAssociationRolesBestEffort(guildieId: string, discordUserId: string): Promise<void> {
  try {
    await removeManagedDiscordRolesForUser(discordUserId, {
      guildieId,
      trigger: "discord-disassociation",
    });
  } catch (error) {
    console.error("Discord disassociation role reconciliation failed", { guildieId, discordUserId, error });
  }
}

export async function registerDiscordRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/discord/connect", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    let oauth: DiscordOAuthConfiguration;
    try {
      oauth = await oauthConfiguration();
    } catch (error) {
      if (error instanceof DiscordOAuthNotConfiguredError) {
        return reply.code(503).send({ error: "discord_not_configured" });
      }
      throw error;
    }

    const query = request.query as { return_to?: unknown };
    const returnTo = safeReturnTo(query.return_to) ?? "/";
    const state = await createAttempt(guildie.guildieId, returnTo);
    return reply.redirect(authorizationUrl(state, oauth));
  });

  app.post("/me/discord/disconnect", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    const moduleConfiguration = await discordModuleRuntimeConfiguration();
    if (!moduleConfiguration.enabled) {
      return reply.code(503).send({ error: "discord_not_enabled" });
    }

    const query = request.query as { return_to?: unknown };
    const returnTo = safeReturnTo(query.return_to) ?? "/";
    const discordUserId = await removeDiscordAssociation(guildie.guildieId);
    if (discordUserId) {
      await removeAssociationRolesBestEffort(guildie.guildieId, discordUserId);
    }
    return reply.redirect(returnTo);
  });

  app.get("/auth/discord/callback", async (request, reply) => {
    const query = request.query as { state?: unknown; code?: unknown; error?: unknown };
    if (typeof query.state !== "string") return reply.code(400).send({ error: "invalid_oauth_callback" });

    const attempt = await consumeAttempt(query.state);
    if (!attempt) return reply.code(400).send({ error: "invalid_or_expired_state" });
    const returnTo = attempt.returnTo ?? "/";

    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie || guildie.guildieId !== attempt.guildieId) {
      return reply.redirect(withDiscordResult(returnTo, "failed"));
    }

    if (typeof query.error === "string" || typeof query.code !== "string") {
      return reply.redirect(withDiscordResult(returnTo, "failed"));
    }

    try {
      const oauth = await oauthConfiguration();
      const accessToken = await exchangeAuthorizationCode(query.code, oauth);
      const user = await acquireDiscordUser(accessToken);
      const result = await establishDiscordAssociation(guildie.guildieId, {
        discordUserId: user.id,
        username: user.username,
      });
      if (result === "conflict") return reply.redirect(withDiscordResult(returnTo, "conflict"));
      await reconcileAssociationBestEffort(guildie.guildieId);
      return reply.redirect(withDiscordResult(returnTo, "connected"));
    } catch (error) {
      request.log.error({ err: error }, "Discord association ceremony failed");
      return reply.redirect(withDiscordResult(returnTo, "failed"));
    }
  });
}
