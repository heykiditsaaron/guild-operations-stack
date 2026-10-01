import { identityRepresentations } from "../identity/guildie-attribution.js";
import { activityParticipationOffersById } from "./participation.js";
import type { ActivityOccurrenceAttribute, ActivitySharedValue } from "./registry.js";

export type ActivityPresentationValue =
  | "raid_participant_card"
  | "raid_participant_pool"
  | "raid_role_lane";

export type ActivityWorkspaceObject = {
  id: string;
  value: ActivitySharedValue;
  presentation: ActivityPresentationValue;
  attributes?: readonly ActivityOccurrenceAttribute[];
};

export type ActivityWorkspacePosition = {
  id: string;
  label: string;
  value?: ActivitySharedValue;
  presentation: ActivityPresentationValue;
};

export type ActivityWorkspacePlacement = {
  objectId: string;
  positionId: string;
  attributes?: readonly ActivityOccurrenceAttribute[];
};

export type ActivityWorkspaceConstraint = {
  kind: "wow_spec_supports_role";
  objectAttributeKind: string;
  positionValueType: "wow_role";
};

export type ActivityWorkspace = {
  kind: string;
  objects: readonly ActivityWorkspaceObject[];
  positions: readonly ActivityWorkspacePosition[];
  placements: readonly ActivityWorkspacePlacement[];
  constraints?: readonly ActivityWorkspaceConstraint[];
};

export type ActivityWorkspaceCapability = {
  project(activityId: string): Promise<ActivityWorkspace | null>;
};

export type ActivityWorkspaceObjectRepresentation = {
  displayName: string;
};

/**
 * Resolve the systemic representation required by workspace objects without
 * transferring identity representation authority to the Activity plugin.
 *
 * A raid participant card is anchored by a Participation Offer. Its display
 * name represents the Offer actor; it does not represent or identify the
 * character implied by any procedural specialization shown on the card.
 */
export async function activityWorkspaceObjectRepresentations(
  workspace: ActivityWorkspace,
): Promise<Map<string, ActivityWorkspaceObjectRepresentation>> {
  const offerObjects = workspace.objects.filter(
    (object) => object.presentation === "raid_participant_card" && object.value.type === "participation_offer",
  );
  if (offerObjects.length === 0) return new Map();

  const offers = await activityParticipationOffersById(offerObjects.map((object) => object.value.value));
  const nativeIdentityIds = [...offers.values()].flatMap((offer) =>
    offer.actor.kind === "native" ? [offer.actor.reference] : []
  );
  const identities = await identityRepresentations(nativeIdentityIds);

  return new Map(offerObjects.flatMap((object) => {
    if (object.value.type !== "participation_offer") return [];
    const offer = offers.get(object.value.value);
    if (!offer) return [];
    const displayName = offer.actor.kind === "native"
      ? identities.get(offer.actor.reference)?.displayName ?? `Identity ${offer.actor.reference.slice(0, 8)}`
      : offer.actor.reference;
    return [[object.id, { displayName }] as const];
  }));
}
