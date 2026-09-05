import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticatedSubject, SESSION_COOKIE_NAME } from "../../auth.js";
import {
  GuildCapabilityDeniedError,
  RAFFLE_ADMIN_CAPABILITY,
  requireGuildCapability,
} from "../../guild-permissions.js";
import {
  RaffleRuleError,
  raffleClaims,
  raffleRound,
  type RaffleRoundTerms,
} from "./domain.js";
import { activateSingleRaffleRound } from "./live-round.js";
import {
  approveRaffleClaim,
  cancelOwnRaffleClaim,
  cancelRaffleRound,
  denyRaffleClaim,
  drawRaffleRound,
  submitRaffleClaim,
} from "./published-operations.js";
import {
  createRegisteredRaffleRound,
  updateRegisteredRaffleRound,
} from "./registered-operations.js";

async function requireSubject(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const subject = await authenticatedSubject(request.cookies[SESSION_COOKIE_NAME]);
  if (!subject) {
    await reply.code(401).send({ error: "not_authenticated" });
    return null;
  }
  return subject.subjectId;
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

function roundTerms(body: Record<string, unknown>): RaffleRoundTerms {
  return {
    drawingAtUnix: requiredInteger(body.drawing_at_unix, "drawing_at_unix"),
    ticketPriceGold: requiredInteger(body.ticket_price_gold, "ticket_price_gold"),
    prizeKind: requiredString(body.prize_kind, "prize_kind"),
    winnerPercentage: nullableInteger(body.winner_percentage, "winner_percentage"),
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
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      const round = await createRegisteredRaffleRound(subjectId, roundTerms(bodyObject(request.body)));
      return reply.code(201).send(round);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.patch<{ Params: { roundId: string } }>("/raffle/rounds/:roundId", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      return await updateRegisteredRaffleRound(subjectId, request.params.roundId, roundTerms(bodyObject(request.body)));
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/live", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      return await activateSingleRaffleRound(subjectId, request.params.roundId);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/cancel", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      return await cancelRaffleRound(subjectId, request.params.roundId);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/draw", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      return await drawRaffleRound(subjectId, request.params.roundId);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.get<{ Params: { roundId: string } }>("/raffle/rounds/:roundId", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    const round = await raffleRound(request.params.roundId);
    if (!round) return reply.code(404).send({ error: "round_not_found" });
    return round;
  });

  app.get<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/claims", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      await requireGuildCapability(subjectId, RAFFLE_ADMIN_CAPABILITY);
      const round = await raffleRound(request.params.roundId);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      return { round_id: round.roundId, claims: await raffleClaims(round.roundId) };
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { roundId: string } }>("/raffle/rounds/:roundId/claims", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    const body = bodyObject(request.body);
    try {
      const claim = await submitRaffleClaim(
        subjectId,
        request.params.roundId,
        requiredString(body.realm_id, "realm_id"),
        requiredString(body.character_id, "character_id"),
        requiredInteger(body.ticket_count, "ticket_count"),
      );
      return reply.code(201).send(claim);
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { claimId: string } }>("/raffle/claims/:claimId/cancel", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      await cancelOwnRaffleClaim(subjectId, request.params.claimId);
      return reply.code(204).send();
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { claimId: string } }>("/raffle/claims/:claimId/approve", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    try {
      await approveRaffleClaim(subjectId, request.params.claimId);
      return reply.code(204).send();
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });

  app.post<{ Params: { claimId: string } }>("/raffle/claims/:claimId/deny", async (request, reply) => {
    const subjectId = await requireSubject(request, reply);
    if (!subjectId) return;
    const body = bodyObject(request.body);
    try {
      await denyRaffleClaim(subjectId, request.params.claimId, requiredString(body.reason, "reason"));
      return reply.code(204).send();
    } catch (error) {
      if (sendDomainError(error, reply)) return;
      throw error;
    }
  });
}
