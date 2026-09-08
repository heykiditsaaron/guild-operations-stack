import type { RaffleRound } from "./domain.js";
import { raffleRoundFactsForAdministration } from "./queries.js";

export type RaffleAdministrationRound = RaffleRound & {
  claimCount: number;
  pendingClaimCount: number;
  approvedClaimCount: number;
  cancelledClaimCount: number;
  deniedClaimCount: number;
  approvedEntryCount: number;
  approvedTicketCount: number;
};

export async function raffleRoundsForAdministration(): Promise<RaffleAdministrationRound[]> {
  const rounds = await raffleRoundFactsForAdministration();
  return rounds.map(({ round, metrics }) => ({
    ...round,
    claimCount: metrics.claimCount,
    pendingClaimCount: metrics.pendingClaimCount,
    approvedClaimCount: metrics.approvedClaimCount,
    cancelledClaimCount: metrics.cancelledClaimCount,
    deniedClaimCount: metrics.deniedClaimCount,
    approvedEntryCount: metrics.approvedEntryCount,
    approvedTicketCount: metrics.approvedEntryCount,
  }));
}
