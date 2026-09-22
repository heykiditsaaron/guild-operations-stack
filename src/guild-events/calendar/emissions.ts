import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { getRaffle } from "../../modules/raffle/application.js";
import { raidEventFacts } from "../../modules/raid/application.js";
import { establishGuildCalendarPoint, withdrawGuildCalendarPoint } from "./registry.js";

const CALENDAR_EMISSION_CODES = [
  "raid.established",
  "raid.modified",
  "raid.cancelled",
  "raffle.established",
  "raffle.modified",
  "raffle.concluded",
  "raffle.cancelled",
] as const;

async function consumeCalendarEmission(emission: Emission): Promise<void> {
  if (emission.code === "raid.cancelled") {
    await withdrawGuildCalendarPoint("raid", emission.subject);
    return;
  }
  if (emission.code === "raffle.cancelled") {
    await withdrawGuildCalendarPoint("raffle", emission.subject);
    return;
  }
  if (emission.code.startsWith("raid.")) {
    const raid = await raidEventFacts(emission.subject);
    if (!raid) throw new Error(`Raid ${emission.subject} was not found while reconciling Calendar`);
    await establishGuildCalendarPoint({
      sourceKind: "raid",
      sourceSubject: raid.raidId,
      occursAt: raid.occursAt,
    });
    return;
  }
  if (emission.code.startsWith("raffle.")) {
    const raffle = await getRaffle(emission.subject);
    if (!raffle) throw new Error(`Raffle ${emission.subject} was not found while reconciling Calendar`);
    await establishGuildCalendarPoint({
      sourceKind: "raffle",
      sourceSubject: raffle.raffleId,
      occursAt: [raffle.drawingAtUnix],
    });
  }
}

export function registerGuildCalendarEmissionConsumers(): void {
  registerEmissionConsumer({
    consumerId: "calendar",
    codes: CALENDAR_EMISSION_CODES,
    receive: consumeCalendarEmission,
  });
}
