import {
  createRaffleRound as createRaffleRoundDomain,
  updateRaffleRound as updateRaffleRoundDomain,
  type RaffleRound,
  type RaffleRoundTerms,
} from "./domain.js";
import { establishRaffleGuildEvent } from "./guild-event-registration.js";

async function coupleGuildEventRegistration(round: RaffleRound): Promise<void> {
  try {
    await establishRaffleGuildEvent(round);
  } catch (error) {
    console.error(
      `[raffle-guild-event] round ${round.roundId} registration could not be synchronized`,
      error,
    );
  }
}

export async function createRegisteredRaffleRound(
  actorSubjectId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  const round = await createRaffleRoundDomain(actorSubjectId, terms);
  await coupleGuildEventRegistration(round);
  return round;
}

export async function updateRegisteredRaffleRound(
  actorSubjectId: string,
  roundId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  const round = await updateRaffleRoundDomain(actorSubjectId, roundId, terms);
  await coupleGuildEventRegistration(round);
  return round;
}

export { coupleGuildEventRegistration };
