import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { acquireAuthority, authorizationUrl, exchangeAuthorizationCode } from "./blizzard.js";
import { config, parseRegion, type Region } from "./config.js";
import { pool } from "./db.js";
import { establishOrResolveSubject } from "./persistence.js";

const SESSION_COOKIE = "guild_session";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

async function createSession(subjectId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO application_sessions (subject_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
    [subjectId, sha256(token), config.sessionTtlDays],
  );
  return token;
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.sessionCookieSecure,
    path: "/",
    maxAge: config.sessionTtlDays * 24 * 60 * 60,
  });
}

async function consumeAttempt(state: string): Promise<{ region: Region; returnTo: string | null } | null> {
  const result = await pool.query<{ region: Region; return_to: string | null }>(
    `UPDATE authentication_attempts
       SET consumed_at = now()
     WHERE state_hash = $1
       AND consumed_at IS NULL
       AND expires_at > now()
     RETURNING region, return_to`,
    [sha256(state)],
  );
  if (!result.rowCount) return null;
  return { region: result.rows[0].region, returnTo: result.rows[0].return_to };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/blizzard/start", async (request, reply) => {
    const query = request.query as { region?: unknown; return_to?: unknown };
    const region = parseRegion(query.region ?? "us");
    if (!region) return reply.code(400).send({ error: "unsupported_region" });

    const returnTo = safeReturnTo(query.return_to);
    const state = randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO authentication_attempts (state_hash, region, return_to, expires_at)
       VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'))`,
      [sha256(state), region, returnTo, config.authAttemptTtlMinutes],
    );

    return reply.redirect(authorizationUrl(state));
  });

  app.get("/auth/blizzard/callback", async (request, reply) => {
    const query = request.query as { state?: unknown; code?: unknown; error?: unknown };
    if (typeof query.state !== "string") {
      return reply.code(400).send({ error: "invalid_oauth_callback" });
    }

    const attempt = await consumeAttempt(query.state);
    if (!attempt) return reply.code(400).send({ error: "invalid_or_expired_state" });

    if (typeof query.error === "string") {
      return reply.code(401).send({ error: "blizzard_authorization_failed" });
    }
    if (typeof query.code !== "string") {
      return reply.code(400).send({ error: "invalid_oauth_callback" });
    }

    try {
      const accessToken = await exchangeAuthorizationCode(query.code);
      const authority = await acquireAuthority(attempt.region, accessToken);
      const subjectId = await establishOrResolveSubject({
        region: attempt.region,
        principalId: authority.principalId,
        profile: authority.profile,
      });
      const sessionToken = await createSession(subjectId);
      setSessionCookie(reply, sessionToken);
      return reply.redirect(attempt.returnTo ?? "/me");
    } catch (error) {
      request.log.error({ err: error }, "Blizzard authentication ceremony failed");
      return reply.code(500).send({ error: "authentication_ceremony_failed" });
    }
  });

  app.get("/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return reply.code(401).send({ error: "not_authenticated" });

    const result = await pool.query<{
      subject_id: string;
      region: Region;
      character_count: string;
    }>(
      `SELECT s.subject_id, bp.region, count(c.character_record_id)::text AS character_count
         FROM application_sessions s
         JOIN blizzard_principals bp ON bp.subject_id = s.subject_id
         LEFT JOIN characters c ON c.subject_id = s.subject_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
        GROUP BY s.subject_id, bp.region`,
      [sha256(token)],
    );
    if (!result.rowCount) return reply.code(401).send({ error: "not_authenticated" });

    return reply.send({
      subject_id: result.rows[0].subject_id,
      region: result.rows[0].region,
      character_count: Number(result.rows[0].character_count),
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await pool.query(
        "UPDATE application_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
        [sha256(token)],
      );
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });
}
