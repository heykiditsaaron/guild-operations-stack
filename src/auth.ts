import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AssetRegistry } from "./web/assets.js";
import { htmlText } from "./web/render.js";
import { renderSetupDocument } from "./web/pages/setup.js";
import { viewerForRequest } from "./web/viewer.js";
import { acquireAuthority, authorizationUrl, exchangeAuthorizationCode, type BlizzardWowProfile } from "./blizzard.js";
import { config, parseRegion, type Region } from "./config.js";
import { pool } from "./db.js";
import {
  acquireCharacterPresentation,
  type CharacterPresentationAcquisitionTarget,
} from "./core/guild/guild-character-enrichment.js";
import { effectiveGuildAuthority } from "./core/authority/guild-permissions.js";
import { installationGuildBinding, installationOperational, requireOperationalInstallationGuildBinding } from "./core/installation/guild-binding.js";
import { controlledGuildMemberCharacters } from "./core/guild/guild-characters.js";
import { characterProjections } from "./core/identity/character-projection.js";
import { characterRepresentationForIdentity, selectCharacterRepresentation } from "./core/identity/main-character.js";
import { publishOperationalRecord } from "./operational-inspection.js";
import {
  discoveredWowAccounts,
  establishOrResolveWowAccountIdentity,
  reconcileExistingWowAccountIdentity,
} from "./core/identity/blizzard-identity.js";
import { installationPublicOrigin } from "./core/installation/public-origin.js";

export const SESSION_COOKIE_NAME = "guild_session";

type AuthenticationPurpose = "login" | "self_refresh";

type AuthenticationAttempt = {
  region: Region;
  returnTo: string | null;
  purpose: AuthenticationPurpose;
  identityId: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function withQueryValue(path: string, key: string, value: string): string {
  const url = new URL(path, "http://guild-operations.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

async function createSession(identityId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO application_sessions (identity_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
    [identityId, sha256(token), config.sessionTtlDays],
  );
  return token;
}

function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: config.sessionTtlDays * 24 * 60 * 60,
  });
}

export async function authenticatedIdentity(token: string | undefined): Promise<{
  identityId: string;
  region: Region;
  characterCount: number;
} | null> {
  if (!token) return null;
  const result = await pool.query<{ identity_id: string; region: Region; character_count: string }>(
    `SELECT s.identity_id, wai.region, count(ccr.character_record_id)::text AS character_count
       FROM application_sessions s
       JOIN wow_account_identities wai ON wai.identity_id = s.identity_id
       LEFT JOIN controlled_character_roster ccr
         ON ccr.identity_id = s.identity_id
        AND ccr.currently_controlled = true
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
      GROUP BY s.identity_id, wai.region`,
    [sha256(token)],
  );
  if (!result.rowCount) return null;
  return { identityId: result.rows[0].identity_id, region: result.rows[0].region, characterCount: Number(result.rows[0].character_count) };
}

async function createAttempt(input: AuthenticationAttempt): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO authentication_attempts (
       state_hash, region, purpose, identity_id, return_to, expires_at
     ) VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 minute'))`,
    [sha256(state), input.region, input.purpose, input.identityId, input.returnTo, config.authAttemptTtlMinutes],
  );
  return state;
}

async function consumeAttempt(state: string): Promise<AuthenticationAttempt | null> {
  const result = await pool.query<{
    region: Region;
    return_to: string | null;
    purpose: AuthenticationPurpose;
    identity_id: string | null;
  }>(
    `UPDATE authentication_attempts
       SET consumed_at = now()
     WHERE state_hash = $1
       AND consumed_at IS NULL
       AND expires_at > now()
     RETURNING region, return_to, purpose, identity_id`,
    [sha256(state)],
  );
  if (!result.rowCount) return null;
  return {
    region: result.rows[0].region,
    returnTo: result.rows[0].return_to,
    purpose: result.rows[0].purpose,
    identityId: result.rows[0].identity_id,
  };
}

async function eligibleCharacterPresentationTargets(
  identityId: string,
): Promise<CharacterPresentationAcquisitionTarget[]> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const result = await pool.query<{
    region: Region;
    realm_id: string;
    character_id: string;
    character_name: string;
    realm_slug: string | null;
  }>(
    `SELECT cr.region, cr.realm_id, cr.character_id, cr.name AS character_name, cr.realm_slug
       FROM controlled_character_roster ccr
       JOIN character_roster cr ON cr.character_record_id = ccr.character_record_id
       JOIN guild_roster gr
         ON gr.character_record_id = cr.character_record_id
        AND gr.currently_present = true
      WHERE ccr.identity_id = $1
        AND ccr.currently_controlled = true
        AND gr.guild_id = $2
      ORDER BY gr.rank_index, cr.name`,
    [identityId, guildId],
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
  identityId: string,
  returnTo: string,
  refreshResult?: "success" | "failed",
): Promise<string> {
  if (!(await installationOperational())) return "/setup";
  let destination = returnTo;
  if (refreshResult) destination = withQueryValue(destination, "refresh", refreshResult);
  const mainCharacter = await characterRepresentationForIdentity(identityId);
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

export async function registerAuthRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
      const params = new URLSearchParams(typeof body === "string" ? body : body.toString("utf8"));
      done(null, Object.fromEntries(params.entries()));
    });
  }
  app.get("/auth/blizzard/start", async (request, reply) => {
    const query = request.query as { region?: unknown; return_to?: unknown };
    const region = parseRegion(query.region ?? "us");
    if (!region) return reply.code(400).send({ error: "unsupported_region" });

    const state = await createAttempt({
      region,
      returnTo: safeReturnTo(query.return_to),
      purpose: "login",
      identityId: null,
    });
    return reply.redirect(await authorizationUrl(state));
  });

  app.get("/me/refresh", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });

    const membership = await effectiveGuildAuthority(identity.identityId);
    if (!membership) return reply.code(403).send({ error: "current_guild_membership_required" });

    const query = request.query as { return_to?: unknown };
    const state = await createAttempt({
      region: identity.region,
      returnTo: safeReturnTo(query.return_to) ?? "/",
      purpose: "self_refresh",
      identityId: identity.identityId,
    });
    return reply.redirect(await authorizationUrl(state));
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
        const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
        if (!identity || !attempt.identityId || identity.identityId !== attempt.identityId) {
          return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
        }

        const membership = await effectiveGuildAuthority(identity.identityId);
        if (!membership) return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));

        try {
          await reconcileExistingWowAccountIdentity({
            identityId: identity.identityId,
            region: attempt.region,
            profile: authority.profile,
          });
        } catch (error) {
          await publishSelfRefreshRecord({
            source: "guildie",
            operation: "self_refresh",
            kind: "exception",
            actorIdentityId: identity.identityId,
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
          const targets = await eligibleCharacterPresentationTargets(identity.identityId);
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
            actorIdentityId: identity.identityId,
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
            actorIdentityId: identity.identityId,
            summary: "Guildie self refresh updated account and Character-control state, but Character presentation acquisition raised an exception.",
            details: {
              account_reconciliation_succeeded: true,
              error: error instanceof Error ? error.message : String(error),
            },
          }, (inspectionError) => {
            request.log.error({ err: inspectionError }, "Operational inspection publication failed for Guildie self refresh");
          });
        }

        return reply.redirect(await redirectAfterIdentityCeremony(identity.identityId, returnTo, "success"));
      }

      const accounts = discoveredWowAccounts(authority.profile);
      if (!accounts.length) return reply.code(409).send({ error: "no_wow_accounts_discovered" });
      const selectionToken = randomBytes(32).toString("base64url");
      await pool.query(
        `INSERT INTO identity_selection_attempts (
           selection_token_hash, region, principal_id, profile_payload, return_to, expires_at
         ) VALUES ($1,$2,$3,$4,$5,now() + ($6 * interval '1 minute'))`,
        [sha256(selectionToken), attempt.region, authority.principalId, authority.profile, returnTo, config.authAttemptTtlMinutes],
      );
      const options = accounts.map((account) => {
        const names = (account.characters ?? []).map((character) => htmlText(character.name)).slice(0, 4).join(", ");
        const accountId = htmlText(account.wowAccountId);
        const detail = names ? ` — ${names}` : "";
        return `<label><input type="radio" name="wow_account_id" value="${accountId}" required> WoW Account ${accountId}${detail}</label>`;
      }).join("<br>");
      return reply.type("text/html; charset=utf-8").send(renderSetupDocument(
        assets,
        `<p>Select the WoW Account you want to use for this Guild Operations session.</p><form method="post" action="/auth/blizzard/select-account"><input type="hidden" name="selection_token" value="${htmlText(selectionToken)}">${options}<p><button class="button-primary setup-action" type="submit">Continue</button></p></form>`,
      ));
    } catch (error) {
      request.log.error({ err: error }, "Blizzard authentication ceremony failed");
      if (attempt.purpose === "self_refresh") {
        return reply.redirect(withQueryValue(returnTo, "refresh", "failed"));
      }
      return reply.code(500).send({ error: "authentication_ceremony_failed" });
    }
  });

  app.post("/auth/blizzard/select-account", async (request, reply) => {
    const body = (request.body ?? {}) as { selection_token?: unknown; wow_account_id?: unknown };
    if (typeof body.selection_token !== "string" || typeof body.wow_account_id !== "string") {
      return reply.code(400).send({ error: "invalid_account_selection" });
    }
    const pending = await pool.query<{ region: Region; profile_payload: BlizzardWowProfile; return_to: string | null }>(
      `UPDATE identity_selection_attempts SET consumed_at = now()
        WHERE selection_token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
        RETURNING region, profile_payload, return_to`,
      [sha256(body.selection_token)],
    );
    if (!pending.rowCount) return reply.code(400).send({ error: "invalid_or_expired_account_selection" });
    try {
      const row = pending.rows[0];
      const identityId = await establishOrResolveWowAccountIdentity({
        region: row.region,
        wowAccountId: body.wow_account_id,
        profile: row.profile_payload,
      });
      const sessionToken = await createSession(identityId);
      const publicOrigin = await installationPublicOrigin();
      setSessionCookie(reply, sessionToken, publicOrigin?.startsWith("https://") ?? false);
      return reply.redirect(await redirectAfterIdentityCeremony(identityId, row.return_to ?? "/"));
    } catch (error) {
      request.log.error({ err: error }, "WoW Account Identity establishment failed");
      return reply.code(409).send({ error: "wow_account_identity_establishment_failed" });
    }
  });

  app.get("/me", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });

    const binding = await installationGuildBinding();
    const operational = binding?.authorizedAt != null;
    const [guildMemberCharacters, mainCharacter] = operational
      ? await Promise.all([
          controlledGuildMemberCharacters(identity.identityId),
          characterRepresentationForIdentity(identity.identityId),
        ])
      : [[], null];
    const guildCharacters = await characterProjections(
      guildMemberCharacters.map((character) => character.characterRecordId),
    );
    const guildMembershipByCharacterRecordId = new Map(
      guildMemberCharacters.map((character) => [character.characterRecordId, character]),
    );

    return reply.send({
      identity_id: identity.identityId,
      region: identity.region,
      character_count: identity.characterCount,
      guild: binding ? {
        guild_id: binding.guildId,
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
          rank: guildMembershipByCharacterRecordId.get(character.characterRecordId)!.rankIndex,
          level: character.level,
          class_name: character.className,
          race_name: character.raceName,
          active_spec_name: character.activeSpecName,
          avatar_url: character.avatarUrl,
          inset_url: character.insetUrl,
          main_url: character.mainUrl,
        })),
      } : null,
    });
  });

  app.put("/me/main-character", async (request, reply) => {
    const identity = await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);
    if (!identity) return reply.code(401).send({ error: "not_authenticated" });

    const body = request.body as { realm_id?: unknown; character_id?: unknown } | null;
    if (!body || typeof body.realm_id !== "string" || typeof body.character_id !== "string") {
      return reply.code(400).send({ error: "invalid_character_coordinate" });
    }

    const selected = await selectCharacterRepresentation(identity.identityId, body.realm_id, body.character_id);
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
