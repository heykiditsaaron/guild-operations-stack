import {
  createRaffleRound as createRaffleRoundDomain,
  updateRaffleRound as updateRaffleRoundDomain,
  type RaffleRound,
  type RaffleRoundTerms,
} from "./domain.js";
import { establishRaffleGuildEvent } from "./guild-event-registration.js";

async function coupleGuildEventListing(round: RaffleRound): Promise<void> {
  try {
    await establishRaffleGuildEvent(round);
  } catch (error) {
    console.error(
      `[raffle-guild-event] round ${round.roundId} listing could not be synchronized`,
      error,
    );
  }
}

export async function createRegisteredRaffleRound(
  actorGuildieId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  const round = await createRaffleRoundDomain(actorGuildieId, terms);
  await coupleGuildEventListing(round);
  return round;
}

export async function updateRegisteredRaffleRound(
  actorGuildieId: string,
  roundId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  const round = await updateRaffleRoundDomain(actorGuildieId, roundId, terms);
  await coupleGuildEventListing(round);
  return round;
}

export { coupleGuildEventListing };
