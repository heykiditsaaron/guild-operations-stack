import type { FastifyInstance, FastifyRequest } from "fastify";
import { getRaffle } from "./application.js";
import {
  getRaffleClaim,
  raffleFacts,
  type RaffleCharacterRecognition,
  type RaffleFacts,
} from "./queries.js";

function readAuthorized(request: FastifyRequest): boolean {
  const configured = process.env.API_READ_KEY;
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

function raffleRepresentation(facts: RaffleFacts) {
  const { raffle, participationOpen, metrics, winner } = facts;
  const pot = BigInt(raffle.entryPriceGold) * BigInt(metrics.approvedEntryCount);
  const winnerPrize = raffle.prizeKind === "gold" && raffle.winnerPercentage !== null
    ? (pot * BigInt(raffle.winnerPercentage)) / 100n
    : null;
  const guildShare = winnerPrize === null ? null : pot - winnerPrize;

  return {
    raffle_id: raffle.raffleId,
    title: raffle.title,
    conclusion: raffle.conclusion,
    drawing_at_unix: raffle.drawingAtUnix,
    participation: {
      open: participationOpen,
      opened_at_unix: raffle.openedAtUnix,
      paused_at_unix: raffle.participationPausedAtUnix,
      resumed_at_unix: raffle.participationResumedAtUnix,
    },
    entry_price_gold: raffle.entryPriceGold,
    prize: {
      kind: raffle.prizeKind,
      winner_percentage: raffle.winnerPercentage,
      description: raffle.prizeDescription,
    },
    created_at_unix: raffle.createdAtUnix,
    concluded_at_unix: raffle.concludedAtUnix,
    claims: {
      pending: metrics.pendingClaimCount,
      approved: metrics.approvedClaimCount,
      denied: metrics.deniedClaimCount,
      revoked: metrics.revokedClaimCount,
      approved_entries: metrics.approvedEntryCount,
    },
    gold: raffle.prizeKind === "gold"
      ? { pot: pot.toString(), winner_prize: winnerPrize?.toString() ?? null, guild_share: guildShare?.toString() ?? null }
      : null,
    total_entries: raffle.totalEntries,
    winning_claim_id: raffle.winningClaimId,
    winner: winner ? { claim_id: winner.claimId, character: characterRepresentation(winner.character) } : null,
  };
}

export async function registerRaffleApiV1Routes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { raffleId: string } }>("/api/v1/raffles/:raffleId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const facts = await raffleFacts(request.params.raffleId);
    if (!facts) return reply.code(404).send({ error: "raffle_not_found" });
    return reply.send(raffleRepresentation(facts));
  });

  app.get<{ Params: { claimId: string } }>("/api/v1/raffle/claims/:claimId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const claim = await getRaffleClaim(request.params.claimId);
    if (!claim) return reply.code(404).send({ error: "claim_not_found" });
    const raffle = await getRaffle(claim.raffleId);
    if (!raffle) return reply.code(404).send({ error: "claim_not_found" });

    return reply.send({
      claim_id: claim.claimId,
      raffle_id: claim.raffleId,
      raffle: { conclusion: raffle.conclusion },
      character: characterRepresentation(claim.character),
      requested_entry_count: claim.requestedEntryCount,
      promised_gold_value: claim.promisedGoldValue,
      created_at_unix: claim.createdAtUnix,
      resolution: { kind: claim.resolutionKind, at_unix: claim.resolutionAtUnix, denial_reason: claim.denialReason },
    });
  });
}
