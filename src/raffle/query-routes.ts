import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { liveRaffleRoundQuery, raffleClaimQuery, raffleRoundQuery } from "./query-view.js";

function configuredQueryKey(): string | null {
  const value = process.env.RAFFLE_QUERY_API_KEY;
  return value && value.trim() ? value : null;
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function sameSecret(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function requireRaffleQueryAuthority(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const expected = configuredQueryKey();
  if (!expected) {
    await reply.code(503).send({ error: "raffle_query_not_configured" });
    return false;
  }

  const provided = bearerToken(request);
  if (!provided || !sameSecret(provided, expected)) {
    await reply.code(401).send({ error: "raffle_query_authority_required" });
    return false;
  }

  return true;
}

export async function registerRaffleQueryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/raffle/query/live", async (request, reply) => {
    if (!await requireRaffleQueryAuthority(request, reply)) return;
    return { round: await liveRaffleRoundQuery() };
  });

  app.get<{ Params: { roundId: string } }>("/raffle/query/rounds/:roundId", async (request, reply) => {
    if (!await requireRaffleQueryAuthority(request, reply)) return;
    const round = await raffleRoundQuery(request.params.roundId);
    if (!round) return reply.code(404).send({ error: "round_not_found" });
    return { round };
  });

  app.get<{ Params: { claimId: string } }>("/raffle/query/claims/:claimId", async (request, reply) => {
    if (!await requireRaffleQueryAuthority(request, reply)) return;
    const claim = await raffleClaimQuery(request.params.claimId);
    if (!claim) return reply.code(404).send({ error: "claim_not_found" });
    return { claim };
  });
}
