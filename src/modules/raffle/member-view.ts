import type { RaffleClaimResolution } from "./domain.js";
import { raffleGuildieAttribution } from "./guildie-attribution.js";
import { raffleClaimFactsForMember } from "./queries.js";

export type RaffleMemberClaim = {
  claimId: string;
  roundId: string;
  characterId: string;
  realmId: string;
  characterName: string;
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAtUnix: number;
  resolutionKind: RaffleClaimResolution;
  resolutionActorLabel: string | null;
  denialReason: string | null;
};

export async function raffleClaimsForMember(guildieId: string, roundId: string): Promise<RaffleMemberClaim[]> {
  const claims = await raffleClaimFactsForMember(guildieId, roundId);
  const actorGuildieIds = new Set(
    claims
      .map((claim) => claim.resolutionActorGuildieId)
      .filter((actorGuildieId): actorGuildieId is string => actorGuildieId !== null),
  );
  const attributionEntries = await Promise.all(
    [...actorGuildieIds].map(async (actorGuildieId) => [
      actorGuildieId,
      await raffleGuildieAttribution(actorGuildieId),
    ] as const),
  );
  const attributionByGuildieId = new Map(attributionEntries);

  return claims.map((claim) => ({
    claimId: claim.claimId,
    roundId: claim.roundId,
    characterId: claim.character.characterId,
    realmId: claim.character.realmId,
    characterName: claim.character.name,
    requestedTicketCount: claim.requestedTicketCount,
    promisedGoldValue: claim.promisedGoldValue,
    createdAtUnix: claim.createdAtUnix,
    resolutionKind: claim.resolutionKind,
    resolutionActorLabel: claim.resolutionActorGuildieId === null
      ? null
      : attributionByGuildieId.get(claim.resolutionActorGuildieId) ?? "Guild officer",
    denialReason: claim.denialReason,
  }));
}
