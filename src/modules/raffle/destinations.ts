import type { GuildEventDestination } from "../../guild-events/publication/contract.js";
import type { RaffleRound } from "./domain.js";

export function raffleRoundPublicDestination(roundId: string): string {
  return `/events/raffle/${encodeURIComponent(roundId)}`;
}

export function raffleParticipationDestination(): string {
  return "/events/raffle/enter";
}

export function raffleRoundOperationDestination(roundId: string): string {
  return `/events/raffle/manage/${encodeURIComponent(roundId)}`;
}

/**
 * Raffle owns the interaction destinations for one concrete round. Shared event
 * discovery may project these destinations, but it does not decide where a
 * Raffle round is viewed, participated in, or operated.
 *
 * Destination order preserves the current discovery interaction: a live round
 * leads directly to participation, while non-live rounds lead to their durable
 * public record. Presence of an operate destination does not grant authority.
 */
export function raffleRoundDestinations(round: Pick<RaffleRound, "roundId" | "status">): readonly GuildEventDestination[] {
  const publicDestination: GuildEventDestination = {
    kind: "public",
    label: "View raffle",
    href: raffleRoundPublicDestination(round.roundId),
  };

  if (round.status === "concluded") return [publicDestination];

  const operateDestination: GuildEventDestination = {
    kind: "operate",
    label: "Manage raffle",
    href: raffleRoundOperationDestination(round.roundId),
  };

  if (round.status === "live") {
    return [
      {
        kind: "participate",
        label: "Enter raffle",
        href: raffleParticipationDestination(),
      },
      publicDestination,
      operateDestination,
    ];
  }

  return [publicDestination, operateDestination];
}
