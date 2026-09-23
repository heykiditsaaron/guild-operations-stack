import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { acquireAuthority, authorizationUrl, exchangeAuthorizationCode } from "./blizzard.js";
import { config, parseRegion, type Region } from "./config.js";
import { pool } from "./db.js";
import {
  acquireCharacterPresentation,
  type CharacterPresentationAcquisitionTarget,
} from "./guild-character-enrichment.js";
import { effectiveGuildAuthority } from "./core/authority/guild-permissions.js";
import { guildCharactersForGuildie } from "./core/guild/guild-characters.js";
import { mainCharacterForGuildie, selectMainCharacter } from "./core/identity/main-character.js";
import { publishOperationalRecord } from "./operational-inspection.js";
import {
  establishOrResolveGuildie,
  reconcileExistingGuildieBlizzardObservation,
} from "./persistence.js";

export const SESSION_COOKIE_NAME = "guild_session";

type AuthenticationPurpose = "login" | "self_refresh";

type AuthenticationAttempt = {
  region: Region;
  returnTo: string | null;
  purpose: AuthenticationPurpose;
  guildieId: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function withQueryValue(path: string, key: string, value: string): string {
  const url = new URL(path, config.appOrigin);
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

async function createSession(guildieId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO application_sessions (guildie_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
    [guildieId, sha256(token), config.sessionTtlDays],
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

export async function authenticatedGuildie(token: string | undefined): Promise<{
  guildieId: string;
  region: Region;
  characterCount: number;
} | null> {
  if (!token) return null;

  const result = await pool.query<{
    guildie_id: string;
    region: Region;
    character_count: string;
  }>(
    `SELECT s.guildie_id, bp.region, count(c.character_record_id)::text AS character_count
       FROM application_sessions s
       JOIN blizzard_principals bp ON bp.guildie_id = s.guildie_id
       LEFT JOIN characters c
         ON c.guildie_id = s.guildie_id
        AND c.currently_controlled = true
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      GROUP BY s.guildie_id, bp.region`,
    [sha256(token)],
  );

  if (!result.rowCount) return null;
  return {
    guildieId: result.rows[0].guildie_id,
    region: result.rows[0].region,
    characterCount: Number(result.rows[0].character_count),
  };
}

async function createAttempt(input: AuthenticationAttempt): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO authentication_attempts (
       state_hash, region, purpose, guildie_id, return_to, expires_at
     ) VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 minute'))`,
    [sha256(state), input.region, input.purpose, input.guildieId, input.returnTo, config.authAttemptTtlMinutes],
  );
  return state;
}

async function consumeAttempt(state: string): Promise<AuthenticationAttempt | null> {
  const result = await pool.query<{
    region: Region;
    return_to: string | null;
    purpose: AuthenticationPurpose;
    guildie_id: string | null;
  }>(
    `UPDATE authentication_attempts
       SET consumed_at = now()
     WHERE state_hash = $1
       AND consumed_at IS NULL
       AND expires_at > now()
     RETURNING region, return_to, purpose, guildie_id`,
    [sha256(state)],
  );
  if (!result.rowCount) return null;
  return {
    region: result.rows[0].region,
    returnTo: result.rows[0].return_to,
    purpose: result.rows[0].purpose,
    guildieId: result.rows[0].guildie_id,
  };
}

async function guildieForBlizzardPrincipal(region: Region, principalId: string): Promise<string | null> {
  const result = await pool.query<{ guildie_id: string }>(
    `SELECT guildie_id FROM blizzard_principals WHERE region = $1 AND principal_id = $2`,
    [region, principalId],
  );
  return result.rows[0]?.guildie_id ?? null;
}

async function eligibleCharacterPresentationTargets(
  guildieId: string,
): Promise<CharacterPresentationAcquisitionTarget[]> {
  const result = await pool.query<{
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_slug: string | null;
  }>(
    `SELECT c.region, c.realm_id, c.character_id, c.name AS character_name, c.realm_slug
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
        AND grm.currently_present = true
      WHERE c.guildie_id = $1
        AND c.currently_controlled = true
        AND grm.guild_id = $2
      ORDER BY grm.rank_index, c.name`,
    [guildieId, config.guild.id],
  );

  return result.rows.map((row) => {
    if (!row.realm_slug) {
      throw new Error(`Eligible character ${row.character_name} is missing realm_slug from the fresh account observation`);
    }
    return {
      region: row.region,
      realmId: row.realm_id,
      characterId: row.character_id,
      characterName: row.character_name,
      realmSlug: row.realm_slug,
      needsProfile: true,
      needsMedia: true,
    };
  });
}

async function redirectAfterIdentityCeremony(
  guildieId: string,
  returnTo: string,
  refreshResult?: "success" | "failed",
): Promise<string> {
  let destination = returnTo;
  if (refreshResult) destination = withQueryValue(destination, "refresh", refreshResult);
  const mainCharacter = await mainCharacterForGuildie(guildieId);
  if (!mainCharacter) destination = withQueryValue(destination, "select_main", "required");
  return destination;
}

async function publishSelfRefreshRecord(
  input: Parameters<typeof publishOperationalRecord>[0],
  onFailure: (error: unknown) => void,
): Promise<void> {
  try {
    await publishOperationalRecord(input);
  } catch (error) {
    onFailure(error);
  }
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
      guildieId: null,
    });
    return reply.redirect(authorizationUrl(state));
  });

  app.get("/me/refresh", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    const membership = await effectiveGuildAuthority(guildie.guildieId);
    if (!membership) return reply.code(403).send({ error: "current_guild_membership_required" });

    const query = request.query as { return_to?: unknown };
    const state = await createAttempt({
      region: guildie.region,
      returnTo: safeReturnTo(query.return_to) ?? "/",
      purpose: "self_refresh",
      guildieId: guildie.guildieId,
    });
    return reply.redirect(authorizationUrl(state));
  });

  app.get("/auth/blizzard/callback", async (request, reply) => {
    const query = request.query as { state?: unknown; code?: unknown; error?: unknown };
    if (typeof query.state !== "string") return reply.code(400).send({ error: "invalid_oauth_callback" });

    const attempt = await consumeAttempt(query.state);
    if (!attempt) return reply.code(400).send({ error: "invalid_or_expired_state" });
    const returnTo = attempt.returnTo ?? "/";

    if (typeof query.error === "string") {
      if (attempt.purpose === "self_refresh") {
        return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
      }
      return reply.code(401).send({ error: "blizzard_authorization_failed" });
    }
    if (typeof query.code !== "string") {
      if (attempt.purpose === "self_refresh") {
        return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
      }
      return reply.code(400).send({ error: "invalid_oauth_callback" });
    }

    try {
      const accessToken = await exchangeAuthorizationCode(query.code);
      const authority = await acquireAuthority(attempt.region, accessToken);

      if (attempt.purpose === "self_refresh") {
        const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
        if (!guildie || !attempt.guildieId || guildie.guildieId !== attempt.guildieId) {
          return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
        }

        const membership = await effectiveGuildAuthority(guildie.guildieId);
        if (!membership) return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));

        const authorityGuildieId = await guildieForBlizzardPrincipal(attempt.region, authority.principalId);
        if (authorityGuildieId !== guildie.guildieId) {
          return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
        }

        try {
          await reconcileExistingGuildieBlizzardObservation({
            guildieId: guildie.guildieId,
            region: attempt.region,
            principalId: authority.principalId,
            profile: authority.profile,
          });
        } catch (error) {
          await publishSelfRefreshRecord({
            source: "guildie",
            operation: "self_refresh",
            kind: "exception",
            actorGuildieId: guildie.guildieId,
            summary: "Guildie self refresh did not complete account and Character-control reconciliation.",
            details: {
              account_reconciliation_succeeded: false,
              error: error instanceof Error ? error.message : String(error),
            },
          }, (inspectionError) => {
            request.log.error({ err: inspectionError }, "Operational inspection publication failed for Guildie self refresh");
          });
          throw error;
        }

        try {
          const targets = await eligibleCharacterPresentationTargets(guildie.guildieId);
          const presentation = await acquireCharacterPresentation({ targets });
          const partial = presentation.failedProfiles > 0 || presentation.failedMedia > 0;

          if (partial) {
            request.log.warn({ presentation }, "Self refresh completed with Character presentation acquisition failures");
          }

          await publishSelfRefreshRecord({
            source: "guildie",
            operation: "self_refresh",
            kind: "result",
            result: partial ? "partial" : "success",
            actorGuildieId: guildie.guildieId,
            summary: partial
              ? "Refreshed Blizzard account and Character-control state; some Character presentation acquisition failed."
              : "Refreshed Blizzard account, Character-control, and Character presentation state.",
            details: {
              account_reconciliation_succeeded: true,
              characters_targeted: targets.length,
              characters_attempted: presentation.attempted,
              profiles_updated: presentation.profilesUpdated,
              media_updated: presentation.mediaUpdated,
              failed_profiles: presentation.failedProfiles,
              failed_media: presentation.failedMedia,
              api_calls: presentation.apiCalls,
              failures: presentation.failures.map((failure) => ({
                character_id: failure.characterId,
                realm_id: failure.realmId,
                name: failure.name,
                stage: failure.stage,
                error: failure.error,
              })),
            },
          }, (inspectionError) => {
            request.log.error({ err: inspectionError }, "Operational inspection publication failed for Guildie self refresh");
          });
        } catch (error) {
          request.log.error({ err: error }, "Self refresh account reconciliation succeeded but Character presentation acquisition failed");
          await publishSelfRefreshRecord({
            source: "guildie",
            operation: "self_refresh",
            kind: "exception",
            actorGuildieId: guildie.guildieId,
            summary: "Guildie self refresh updated account and Character-control state, but Character presentation acquisition raised an exception.",
            details: {
              account_reconciliation_succeeded: true,
              error: error instanceof Error ? error.message : String(error),
            },
          }, (inspectionError) => {
            request.log.error({ err: inspectionError }, "Operational inspection publication failed for Guildie self refresh");
          });
        }

        return reply.redirect(await redirectAfterIdentityCeremony(guildie.guildieId, returnTo, "success"));
      }

      const guildieId = await establishOrResolveGuildie({
        region: attempt.region,
        principalId: authority.principalId,
        profile: authority.profile,
      });
      const sessionToken = await createSession(guildieId);
      setSessionCookie(reply, sessionToken);
      return reply.redirect(await redirectAfterIdentityCeremony(guildieId, returnTo));
    } catch (error) {
      request.log.error({ err: error }, "Blizzard authentication ceremony failed");
      if (attempt.purpose === "self_refresh") {
        return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
      }
      return reply.code(500).send({ error: "authentication_ceremony_failed" });
    }
  });

  app.get("/me", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    const [guildCharacters, mainCharacter] = await Promise.all([
      guildCharactersForGuildie(guildie.guildieId),
      mainCharacterForGuildie(guildie.guildieId),
    ]);

    return reply.send({
      guildie_id: guildie.guildieId,
      region: guildie.region,
      character_count: guildie.characterCount,
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
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "not_authenticated" });

    const body = request.body as { realm_id?: unknown; character_id?: unknown } | null;
    if (!body || typeof body.realm_id !== "string" || typeof body.character_id !== "string") {
      return reply.code(400).send({ error: "invalid_character_coordinate" });
    }

    const selected = await selectMainCharacter(guildie.guildieId, body.realm_id, body.character_id);
    if (!selected) return reply.code(409).send({ error: "character_not_currently_eligible" });

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
