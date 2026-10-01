import type { ActivityOccurrence, ActivitySharedValue } from "../core/activity/registry.js";
import { activityParticipationOfferById } from "../core/activity/participation.js";
import { identityRepresentations } from "../core/identity/guildie-attribution.js";
import { pool } from "../db.js";
import { htmlText } from "./render.js";

function renderActivitySharedValue(value: ActivitySharedValue): string {
  const rendered = value.type === "wow_spec"
    ? htmlText(`${value.value.specName} ${value.value.className}`)
    : value.type === "guild_character"
      ? htmlText(value.value.name)
      : htmlText(String(value.value));
  return "unit" in value && value.unit
    ? `${rendered} ${htmlText(value.unit)}`
    : rendered;
}

async function renderParticipationOffer(
  occurrence: Pick<ActivityOccurrence, "activityKind" | "activityId">,
  participationOfferId: string,
): Promise<string> {
  const client = await pool.connect();
  try {
    const offer = await activityParticipationOfferById(client, {
      activityKind: occurrence.activityKind,
      activityId: occurrence.activityId,
      participationOfferId,
    });
    if (!offer) return "Participation offer unavailable";

    if (offer.actor.kind === "external") return htmlText(offer.actor.reference);

    const representation = (await identityRepresentations([offer.actor.reference])).get(offer.actor.reference);
    return htmlText(representation?.displayName ?? `Identity ${offer.actor.reference.slice(0, 8)}`);
  } finally {
    client.release();
  }
}

export function renderActivitySharedValues(
  value: ActivitySharedValue | readonly ActivitySharedValue[],
): string {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => renderActivitySharedValue(item)).join(", ");
}

export async function renderActivityOccurrenceSharedValues(
  occurrence: Pick<ActivityOccurrence, "activityKind" | "activityId">,
  value: ActivitySharedValue | readonly ActivitySharedValue[],
): Promise<string> {
  const values = Array.isArray(value) ? value : [value];
  const rendered = await Promise.all(values.map((item) =>
    item.type === "participation_offer"
      ? renderParticipationOffer(occurrence, item.value)
      : Promise.resolve(renderActivitySharedValue(item))
  ));
  return rendered.join(", ");
}
