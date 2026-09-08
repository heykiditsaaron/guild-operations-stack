import type { RaffleRound } from "./domain.js";
import { concludedRaffleRoundFacts } from "./queries.js";

export type RaffleHistoryRound = RaffleRound & {
  approvedEntryCount: number;
  winnerCharacterName: string | null;
  winnerAvatarUrl: string | null;
};

export async function raffleHistory(): Promise<RaffleHistoryRound[]> {
  const rounds = await concludedRaffleRoundFacts();
  return rounds.map(({ round, metrics, winner }) => ({
    ...round,
    approvedEntryCount: metrics.approvedEntryCount,
    winnerCharacterName: winner?.character.name ?? null,
    winnerAvatarUrl: winner?.avatarUrl ?? null,
  }));
}

export async function latestDrawnRaffleWinner(): Promise<RaffleHistoryRound | null> {
  const rounds = await raffleHistory();
  return rounds.find((round) => round.conclusion === "drawn") ?? null;
}
