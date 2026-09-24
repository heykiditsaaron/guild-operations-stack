import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import {
  activityTemporalEmissionCodes,
  activityTemporalProjectionForEmission,
} from "../activity/temporal.js";
import { establishGuildCalendarPoint, withdrawGuildCalendarPoint } from "./registry.js";

async function consumeCalendarEmission(emission: Emission): Promise<void> {
  const projection = await activityTemporalProjectionForEmission(emission.code, emission.subject);
  if (!projection) return;

  if (projection.occursAt === null) {
    await withdrawGuildCalendarPoint(projection.activityKind, projection.activityId);
    return;
  }

  await establishGuildCalendarPoint({
    sourceKind: projection.activityKind,
    sourceSubject: projection.activityId,
    occursAt: projection.occursAt,
  });
}

export function registerGuildCalendarEmissionConsumers(): void {
  registerEmissionConsumer({
    consumerId: "calendar",
    codes: activityTemporalEmissionCodes(),
    receive: consumeCalendarEmission,
  });
}
