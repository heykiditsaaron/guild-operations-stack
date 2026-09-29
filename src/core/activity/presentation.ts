import type { ActivityOccurrenceAttribute, ActivitySharedValue } from "./registry.js";

export type ActivityPresentationValue =
  | "raid_participant_card"
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
