import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "./auth.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { publishEvent } from "./events/publisher.js";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_CURRENT_USER_URL = "https://discord.com/api/v10/users/@me";

export type DiscordAssociation = {
  discordUserId: string;
  username: string;
  connectedAt: Date;
};

type DiscordAttempt = {
  subjectId: string;
  returnTo: string | null;
};

type DiscordUser = {
  id: string;
  username: string;
};

type AssociationResult = "established" | "already_associated" | "conflict";

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

function authorizationUrl(state: string): string {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.discordClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.discordRedirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

async function createAttempt(subjectId: string, returnTo: string | null): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO discord_association_attempts (state_hash, subject_id, return_to, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'))`,
    [sha256(state), subjectId, returnTo, config.authAttemptTtlMinutes],
  );
  return state;
}

async function consumeAttempt(state: string): Promise<DiscordAttempt | null> {
  const result = await pool.query<{ subject_id: string; return_to: string | null }>(
    `UPDATE discord_association_attempts
        SET consumed_at = now()
      WHERE state_hash = $1
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING subject_id, return_to`,
    [sha256(state)],
  );
  if (!result.rowCount) return null;
  return {
    subjectId: result.rows[0].subject_id,
    returnTo: result.rows[0].return_to,
  };
}

async function exchangeAuthorizationCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.discordClientId,
    client_secret: config.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.discordRedirectUri,
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

async function establishAssociation(subjectId: string, user: DiscordUser): Promise<AssociationResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ subject_id: string; discord_user_id: string }>(
      `SELECT subject_id, discord_user_id
         FROM discord_associations
        WHERE subject_id = $1 OR discord_user_id = $2
        FOR UPDATE`,
      [subjectId, user.id],
    );

    if (existing.rowCount) {
      const same = existing.rows.find(
        (row) => row.subject_id === subjectId && row.discord_user_id === user.id,
      );
      if (!same || existing.rows.length !== 1) {
        await client.query("ROLLBACK");
        return "conflict";
      }

      await client.query(
        "UPDATE discord_associations SET username = $1 WHERE subject_id = $2",
        [user.username, subjectId],
      );
      await client.query("COMMIT");
      return "already_associated";
    }

    try {
      await client.query(
        `INSERT INTO discord_associations (subject_id, discord_user_id, username)
         VALUES ($1, $2, $3)`,
        [subjectId, user.id, user.username],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        await client.query("ROLLBACK");
        return "conflict";
      }
      throw error;
    }

    await client.query("COMMIT");
    return "established";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function discordAssociationForSubject(subjectId: string): Promise<DiscordAssociation | null> {
  const result = await pool.query<{
    discord_user_id: string;
    username: string;
    connected_at: Date;
  }>(
    `SELECT discord_user_id, username, connected_at
       FROM discord_associations
      WHERE subject_id = $1`,
    [subjectId],
  );
  if (!result.rowCount) return null;
  return {
    discordUserId: result.rows[0].discord_user_id,
    username: result.rows[0].username,
    connectedAt: result.rows[0].connected_at,
  };
}

export async function registerDiscordRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/discord/connect", async (request, reply) => {
    const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
    if (!subject) return reply.code(401).send({ error: "not_authenticated" });

    const query = request.query as { return_to?: unknown };
    const returnTo = safeReturnTo(query.return_to) ?? "/";
    const state = await createAttempt(subject.subjectId, returnTo);
    return reply.redirect(authorizationUrl(state));
  });

  app.post("/me/discord/disconnect", async (request, reply) => {
    const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
    if (!subject) return reply.code(401).send({ error: "not_authenticated" });

    const query = request.query as { return_to?: unknown };
    const returnTo = safeReturnTo(query.return_to) ?? "/";
    const deleted = await pool.query<{ discord_user_id: string }>(
      "DELETE FROM discord_associations WHERE subject_id = $1 RETURNING discord_user_id",
      [subject.subjectId],
    );
    const discordUserId = deleted.rows[0]?.discord_user_id;
    if (discordUserId) {
      await publishEvent({
        kind: "subject.discord.unlinked",
        subjectId: subject.subjectId,
        discordUserId,
      });
    }
    return reply.redirect(returnTo);
  });

  app.get("/auth/discord/callback", async (request, reply) => {
    const query = request.query as { state?: unknown; code?: unknown; error?: unknown };
    if (typeof query.state !== "string") return reply.code(400).send({ error: "invalid_oauth_callback" });

    const attempt = await consumeAttempt(query.state);
    if (!attempt) return reply.code(400).send({ error: "invalid_or_expired_state" });
    const returnTo = attempt.returnTo ?? "/";

    const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
    if (!subject || subject.subjectId !== attempt.subjectId) {
      return reply.redirect(withDiscordResult(returnTo, "failed"));
    }

    if (typeof query.error === "string" || typeof query.code !== "string") {
      return reply.redirect(withDiscordResult(returnTo, "failed"));
    }

    try {
      const accessToken = await exchangeAuthorizationCode(query.code);
      const user = await acquireDiscordUser(accessToken);
      const result = await establishAssociation(subject.subjectId, user);
      if (result === "conflict") return reply.redirect(withDiscordResult(returnTo, "conflict"));
      if (result === "established") {
        await publishEvent({
          kind: "subject.discord.linked",
          subjectId: subject.subjectId,
          discordUserId: user.id,
        });
      }
      return reply.redirect(withDiscordResult(returnTo, "connected"));
    } catch (error) {
      request.log.error({ err: error }, "Discord association ceremony failed");
      return reply.redirect(withDiscordResult(returnTo, "failed"));
    }
  });
}
