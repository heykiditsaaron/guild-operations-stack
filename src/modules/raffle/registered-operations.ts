import { withTransaction } from "../../db.js";
import {
  createRaffleRound as createRaffleRoundDomain,
  updateRaffleRound as updateRaffleRoundDomain,
  type RaffleRound,
  type RaffleRoundTerms,
} from "./domain.js";
import { establishRaffleCalendarListing } from "./calendar-listing.js";

export async function createRegisteredRaffleRound(
  actorGuildieId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  return withTransaction(async (client) => {
    const round = await createRaffleRoundDomain(actorGuildieId, terms, client);
    await establishRaffleCalendarListing(round, client);
    return round;
  });
}

export async function updateRegisteredRaffleRound(
  actorGuildieId: string,
  roundId: string,
  terms: RaffleRoundTerms,
): Promise<RaffleRound> {
  return withTransaction(async (client) => {
    const round = await updateRaffleRoundDomain(actorGuildieId, roundId, terms, client);
    await establishRaffleCalendarListing(round, client);
    return round;
  });
}
