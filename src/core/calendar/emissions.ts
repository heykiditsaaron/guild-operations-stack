import type { Emission } from "../../emissions/contract.js";
import { registerEmissionConsumer } from "../../emissions/registry.js";
import { ACTIVITY_TEMPORAL_RELEVANCE_CHANGED } from "../activity/declarations.js";
import { activityTemporalProjection } from "../activity/registry.js";
import { establishGuildCalendarPoint, withdrawGuildCalendarPoint } from "./registry.js";

async function consumeCalendarEmission(emission: Emission): Promise<void> {
  if (!emission.parent) return;
  const projection = await activityTemporalProjection(emission.parent, emission.subject);
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
    codes: [ACTIVITY_TEMPORAL_RELEVANCE_CHANGED],
    receive: consumeCalendarEmission,
  });
}
