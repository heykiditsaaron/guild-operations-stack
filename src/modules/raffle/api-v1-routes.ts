import type { FastifyInstance, FastifyRequest } from "fastify";
import { getRaffleRound } from "./application.js";
import {
  liveRaffleRoundFacts,
  raffleClaimFacts,
  raffleRoundFacts,
  type RaffleCharacterRecognition,
  type RaffleRoundFacts,
} from "./queries.js";

function readAuthorized(request: FastifyRequest): boolean {
  const configured = process.env.API_READ_KEY || process.env.RAFFLE_QUERY_API_KEY;
  if (!configured) return false;
  const header = request.headers.authorization;
  return header === configured || header === `Bearer ${configured}`;
}

function characterRepresentation(character: RaffleCharacterRecognition) {
  return {
    character_id: character.characterId,
    name: character.name,
    realm_id: character.realmId,
    realm_name: character.realmName,
    realm_slug: character.realmSlug,
  };
}

function roundRepresentation(facts: RaffleRoundFacts) {
  const { round, metrics, winner } = facts;
  const pot = BigInt(round.ticketPriceGold) * BigInt(metrics.approvedEntryCount);
  const winnerPrize = round.prizeKind === "gold" && round.winnerPercentage !== null
    ? (pot * BigInt(round.winnerPercentage)) / 100n
    : null;
  const guildShare = winnerPrize === null ? null : pot - winnerPrize;

  return {
    round_id: round.roundId,
    title: round.roundTitle,
    status: round.status,
    conclusion: round.conclusion,
    drawing_at_unix: round.drawingAtUnix,
    ticket_price_gold: round.ticketPriceGold,
    prize: {
      kind: round.prizeKind,
      winner_percentage: round.winnerPercentage,
      description: round.prizeDescription,
    },
    created_at_unix: round.createdAtUnix,
    live_at_unix: round.liveAtUnix,
    concluded_at_unix: round.concludedAtUnix,
    claims: {
      pending: metrics.pendingClaimCount,
      approved: metrics.approvedClaimCount,
      denied: metrics.deniedClaimCount,
      cancelled: metrics.cancelledClaimCount,
      approved_entries: metrics.approvedEntryCount,
    },
    gold: round.prizeKind === "gold"
      ? {
          pot: pot.toString(),
          winner_prize: winnerPrize?.toString() ?? null,
          guild_share: guildShare?.toString() ?? null,
        }
      : null,
    total_entries: round.totalEntries,
    winning_claim_id: round.winningClaimId,
    winner: winner
      ? {
          claim_id: winner.claimId,
          character: characterRepresentation(winner.character),
        }
      : null,
  };
}

export async function registerRaffleApiV1Routes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/raffle/rounds/live", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const facts = await liveRaffleRoundFacts();
    return reply.send({ round: facts ? roundRepresentation(facts) : null });
  });

  app.get<{ Params: { roundId: string } }>("/api/v1/raffle/rounds/:roundId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const facts = await raffleRoundFacts(request.params.roundId);
    if (!facts) return reply.code(404).send({ error: "round_not_found" });
    return reply.send(roundRepresentation(facts));
  });

  app.get<{ Params: { claimId: string } }>("/api/v1/raffle/claims/:claimId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const claim = await raffleClaimFacts(request.params.claimId);
    if (!claim) return reply.code(404).send({ error: "claim_not_found" });

    const round = await getRaffleRound(claim.roundId);
    if (!round) return reply.code(404).send({ error: "claim_not_found" });

    return reply.send({
      claim_id: claim.claimId,
      round_id: claim.roundId,
      round: {
        status: round.status,
        conclusion: round.conclusion,
      },
      character: characterRepresentation(claim.character),
      requested_entry_count: claim.requestedTicketCount,
      promised_gold_value: claim.promisedGoldValue,
      created_at_unix: claim.createdAtUnix,
      resolution: {
        kind: claim.resolutionKind,
        at_unix: claim.resolutionAtUnix,
        denial_reason: claim.denialReason,
      },
    });
  });
}
