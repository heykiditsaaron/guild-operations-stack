import type { RaffleRound } from "./domain.js";
import { raffleRoundFactsForAdministration } from "./queries.js";

export type RaffleOperationRound = RaffleRound & {
  claimCount: number;
  pendingClaimCount: number;
  approvedClaimCount: number;
  cancelledClaimCount: number;
  deniedClaimCount: number;
  approvedEntryCount: number;
};

export async function raffleRoundsForOperation(): Promise<RaffleOperationRound[]> {
  const rounds = await raffleRoundFactsForAdministration();
  return rounds.map(({ round, metrics }) => ({
    ...round,
    claimCount: metrics.claimCount,
    pendingClaimCount: metrics.pendingClaimCount,
    approvedClaimCount: metrics.approvedClaimCount,
    cancelledClaimCount: metrics.cancelledClaimCount,
    deniedClaimCount: metrics.deniedClaimCount,
    approvedEntryCount: metrics.approvedEntryCount,
  }));
}
