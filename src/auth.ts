import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { acquireAuthority, authorizationUrl, exchangeAuthorizationCode } from "./blizzard.js";
import { config, parseRegion, type Region } from "./config.js";
import { pool } from "./db.js";
import { effectiveGuildAuthority } from "./guild-permissions.js";
import { guildCharactersForSubject } from "./guild.js";
import { mainCharacterForSubject, selectMainCharacter } from "./main-character.js";
import { establishOrResolveSubject } from "./persistence.js";

export const SESSION_COOKIE_NAME = "guild_session";

type AuthenticationPurpose = "login" | "self_refresh";

type AuthenticationAttempt = {
  region: Region;
  returnTo: string | null;
  purpose: AuthenticationPurpose;
  subjectId: string | null;
};

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
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.sessionCookieSecure,
    path: "/",
    maxAge: config.sessionTtlDays * 24 * 60 * 60,
  });
}

export async function authenticatedSubject(token: string | undefined): Promise<{
  subjectId: string;
  region: Region;
  characterCount: number;
} | null> {
  if (!token) return null;

  const result = await pool.query<{
    subject_id: string;
    region: Region;
    character_count: string;
  }>(
    `SELECT s.subject_id, bp.region, count(c.character_record_id)::text AS character_count
       FROM application_sessions s
       JOIN blizzard_principals bp ON bp.subject_id = s.subject_id
       LEFT JOIN characters c
         ON c.subject_id = s.subject_id
        AND c.currently_controlled = true
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      GROUP BY s.subject_id, bp.region`,
    [sha256(token)],
  );

  if (!result.rowCount) return null;
  return {
    subjectId: result.rows[0].subject_id,
    region: result.rows[0].region,
    characterCount: Number(result.rows[0].character_count),
  };
}

async function createAttempt(input: AuthenticationAttempt): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO authentication_attempts (
       state_hash, region, purpose, subject_id, return_to, expires_at
     ) VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 minute'))`,
    [
      sha256(state),
      input.region,
      input.purpose,
      input.subjectId,
      input.returnTo,
      config.authAttemptTtlMinutes,
    ],
  );
  return state;
}

async function consumeAttempt(state: string): Promise<AuthenticationAttempt | null> {
  const result = await pool.query<{
    region: Region;
    return_to: string | null;
    purpose: AuthenticationPurpose;
    subject_id: string | null;
  }>(
    `UPDATE authentication_attempts
       SET consumed_at = now()
     WHERE state_hash = $1
       AND consumed_at IS NULL
       AND expires_at > now()
     RETURNING region, return_to, purpose, subject_id`,
    [sha256(state)],
  );
  if (!result.rowCount) return null;
  return {
    region: result.rows[0].region,
    returnTo: result.rows[0].return_to,
    purpose: result.rows[0].purpose,
    subjectId: result.rows[0].subject_id,
  };
}

async function subjectForBlizzardPrincipal(region: Region, principalId: string): Promise<string | null> {
  const result = await pool.query<{ subject_id: string }>(
    `SELECT subject_id
       FROM blizzard_principals
      WHERE region = $1
        AND principal_id = $2`,
    [region, principalId],
  );
  return result.rows[0]?.subject_id ?? null;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/blizzard/start", async (request, reply) => {
    const query = request.query as { region?: unknown; return_to?: unknown };
    const region = parseRegion(query.region ?? "us");
    if (!region) return reply.code(400).send({ error: "unsupported_region" });

    const state = await createAttempt({
      region,
      returnTo: safeReturnTo(query.return_to),
      purpose: "login",
      subjectId: null,
    });
    return reply.redirect(authorizationUrl(state));
  });

  app.get("/me/refresh", async (request, reply) => {
    const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
    if (!subject) return reply.code(401).send({ error: "not_authenticated" });

    const membership = await effectiveGuildAuthority(subject.subjectId);
    if (!membership) return reply.code(403).send({ error: "current_guild_membership_required" });

    const query = request.query as { return_to?: unknown };
    const state = await createAttempt({
      region: subject.region,
      returnTo: safeReturnTo(query.return_to) ?? "/me",
      purpose: "self_refresh",
      subjectId: subject.subjectId,
    });
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

      if (attempt.purpose === "self_refresh") {
        const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
        if (!subject || !attempt.subjectId || subject.subjectId !== attempt.subjectId) {
          return reply.code(401).send({ error: "self_refresh_session_mismatch" });
        }

        const membership = await effectiveGuildAuthority(subject.subjectId);
        if (!membership) {
          return reply.code(403).send({ error: "current_guild_membership_required" });
        }

        const authoritySubjectId = await subjectForBlizzardPrincipal(attempt.region, authority.principalId);
        if (authoritySubjectId !== subject.subjectId) {
          return reply.code(409).send({ error: "blizzard_principal_mismatch" });
        }

        await establishOrResolveSubject({
          region: attempt.region,
          principalId: authority.principalId,
          profile: authority.profile,
        });
        return reply.redirect(attempt.returnTo ?? "/me");
      }

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
    const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
    if (!subject) return reply.code(401).send({ error: "not_authenticated" });

    const [guildCharacters, mainCharacter] = await Promise.all([
      guildCharactersForSubject(subject.subjectId),
      mainCharacterForSubject(subject.subjectId),
    ]);

    return reply.send({
      subject_id: subject.subjectId,
      region: subject.region,
      character_count: subject.characterCount,
      guild: {
        guild_id: config.guild.id,
        main_character: mainCharacter
          ? {
              character_id: mainCharacter.characterId,
              realm_id: mainCharacter.realmId,
              name: mainCharacter.name,
              realm_name: mainCharacter.realmName,
              rank: mainCharacter.rankIndex,
              currently_eligible: mainCharacter.currentlyEligible,
              avatar_url: mainCharacter.avatarUrl,
            }
          : null,
        characters: guildCharacters.map((character) => ({
          character_id: character.characterId,
          realm_id: character.realmId,
          name: character.name,
          realm_name: character.realmName,
          rank: character.rankIndex,
          level: character.level,
          class_name: character.className,
          race_name: character.raceName,
          active_spec_name: character.activeSpecName,
          avatar_url: character.avatarUrl,
          inset_url: character.insetUrl,
          main_url: character.mainUrl,
        })),
      },
    });
  });

  app.put("/me/main-character", async (request, reply) => {
    const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
    if (!subject) return reply.code(401).send({ error: "not_authenticated" });

    const body = request.body as { realm_id?: unknown; character_id?: unknown } | null;
    if (!body || typeof body.realm_id !== "string" || typeof body.character_id !== "string") {
      return reply.code(400).send({ error: "invalid_character_coordinate" });
    }

    const selected = await selectMainCharacter(subject.subjectId, body.realm_id, body.character_id);
    if (!selected) {
      return reply.code(409).send({ error: "character_not_currently_eligible" });
    }

    return reply.send({
      guild_id: selected.guildId,
      main_character: {
        character_id: selected.characterId,
        realm_id: selected.realmId,
        name: selected.name,
        realm_name: selected.realmName,
        rank: selected.rankIndex,
        currently_eligible: selected.currentlyEligible,
        avatar_url: selected.avatarUrl,
      },
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await pool.query(
        "UPDATE application_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
        [sha256(token)],
      );
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.code(204).send();
  });
}
