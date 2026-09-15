import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { GuildCapabilityDeniedError } from "../../guild-permissions.js";
import {
  RaffleRuleError,
  activateRaffleRound,
  approveRaffleClaim,
  cancelOwnRaffleClaim,
  cancelRaffleRound,
  createRaffleRound,
  denyRaffleClaim,
  drawRaffleRound,
  getRaffleRound,
  listRaffleRoundClaims,
  submitRaffleClaim,
  updateRaffleRound,
  type RafflePrizeKind,
  type RaffleRoundTerms,
} from "./application.js";
import { requireRaffleOperation } from "./authorization.js";

async function requireGuildie(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
  if (!guildie) {
    await reply.code(401).send({ error: "not_authenticated" });
    return null;
  }
  return guildie.guildieId;
}

function bodyObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RaffleRuleError("invalid_input", `${field} is required`, 400);
  }
  return value.trim();
}

function nullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new RaffleRuleError("invalid_input", `${field} must be a string`, 400);
  }
  return value.trim() || null;
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new RaffleRuleError("invalid_input", `${field} must be an integer`, 400);
  }
  return value;
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return requiredInteger(value, field);
}

function requiredPrizeKind(value: unknown): RafflePrizeKind {
  const kind = requiredString(value, "prize_kind");
  if (kind !== "gold" && kind !== "item" && kind !== "other") {
    throw new RaffleRuleError("invalid_input", "prize_kind must be gold, item, or other", 400);
  }
  return kind;
}

function roundTerms(body: Record<string, unknown>): RaffleRoundTerms {
  return {
    roundTitle: nullableString(body.round_title, "round_title"),
    drawingAtUnix: requiredInteger(body.drawing_at_unix, "drawing_at_unix"),
    entryPriceGold: requiredInteger(body.entry_price_gold, "entry_price_gold"),
    prizeKind: requiredPrizeKind(body.prize_kind),
    winnerPercentage: nullableInteger(body.winner_percentage, "winner_percentage"),
    prizeDescription: nullableString(body.prize_description, "prize_description"),
  };
}

function sendDomainError(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof GuildCapabilityDeniedError) {
    void reply.code(403).send({ error: "guild_capability_required", capability: error.capability });
    return true;
  }
  if (error instanceof RaffleRuleError) {
    void reply.code(error.statusCode).send({ error: error.code, message: error.message });
    return true;
  }
  return false;
}

export async function registerRaffleRoutes(app: FastifyInstance): Promise<void> {
  app.post("/raffle/rounds", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      const round = await createRaffleRound(guildieId, roundTerms(bodyObject(request.body)));
      return reply.code(201).send(round);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.patch<{ Params: { roundId: string } }>("/raffle/rounds/:roundId", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      return await updateRaffleRound(guildieId, request.params.roundId, roundTerms(bodyObject(request.body)));
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/live", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      return await activateRaffleRound(guildieId, request.params.roundId);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/cancel", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      return await cancelRaffleRound(guildieId, request.params.roundId);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/draw", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      return await drawRaffleRound(guildieId, request.params.roundId);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.get<{ Params: { roundId: string } }>("/raffle/rounds/:roundId", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    const round = await getRaffleRound(request.params.roundId);
    if (!round) return reply.code(404).send({ error: "round_not_found" });
    return round;
  });

  app.get<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/claims", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      await requireRaffleOperation(guildieId);
      const round = await getRaffleRound(request.params.roundId);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      return { round_id: round.roundId, claims: await listRaffleRoundClaims(round.roundId) };
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/claims", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    const body = bodyObject(request.body);
    try {
      const claim = await submitRaffleClaim(
        guildieId,
        request.params.roundId,
        requiredString(body.realm_id, "realm_id"),
        requiredString(body.character_id, "character_id"),
        requiredInteger(body.entry_count, "entry_count"),
      );
      return reply.code(201).send(claim);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { claimId: string } }>("/raffle/claims/:claimId/cancel", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      await cancelOwnRaffleClaim(guildieId, request.params.claimId);
      return reply.code(204).send();
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { claimId: string } }>("/raffle/claims/:claimId/approve", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    try {
      await approveRaffleClaim(guildieId, request.params.claimId);
      return reply.code(204).send();
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { claimId: string } }>("/raffle/claims/:claimId/deny", async (request, reply) => {
    const guildieId = await requireGuildie(request, reply);
    if (!guildieId) return;
    const body = bodyObject(request.body);
    try {
      await denyRaffleClaim(guildieId, request.params.claimId, requiredString(body.reason, "reason"));
      return reply.code(204).send();
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });
}
