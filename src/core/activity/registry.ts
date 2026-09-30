import { activityRecord, activityRecords } from "./records.js";
import { activityParticipationOffersForIdentity as participationOffersForIdentity, activityParticipationsForIdentity as participationsForIdentity } from "./participation.js";
import { knownActivityPlugin, knownActivityPlugins } from "./plugin-control.js";
import { knownActivityCapabilityDeclarations } from "./plugin-administration.js";
import { registerGuildCapabilityDefinitions, type GuildCapabilityDefinition } from "../authority/guild-capability-policy.js";
import type { ActivityWorkspace, ActivityWorkspaceCapability } from "./presentation.js";

export type ActivityTemporalCoordinate = {
  start: number | null;
  end: number | null;
};

export type ActivityCalendarCoordinate = readonly [number] | readonly [number, number];

export type ActivityTemporalProjection = {
  activityKind: string;
  activityId: string;
  occursAt: ActivityCalendarCoordinate | null;
};

export type ActivitySharedValue =
  | { type: "string"; value: string }
  | { type: "integer"; value: number }
  | { type: "bigint"; value: string; unit?: string }
  | { type: "guildie"; value: string }
  | { type: "guild_character"; value: { characterRecordId: string; region: string; realmId: string; characterId: string; name: string } }
  | { type: "wow_class"; value: string }
  | { type: "wow_spec"; value: { className: string; specName: string } }
  | { type: "wow_role"; value: "tank" | "healer" | "damage" }
  | { type: "participation_offer"; value: string };

export type ActivityOccurrenceAttribute = {
  kind: string;
  label: string;
  provenance: "declared" | "derived";
  value: ActivitySharedValue | readonly ActivitySharedValue[];
};

export type ActivityInteractionKind = "participate" | "operate";

export type ActivityKindInteractionKind = "establish";

export type ActivityKindInteractionCapability = {
  label(kind: ActivityKindInteractionKind): string;
  destination(kind: ActivityKindInteractionKind): string | null;
  availableTo?(kind: ActivityKindInteractionKind, guildieId: string | null): boolean | Promise<boolean>;
};

export type ActivityInteractionRequest = {
  kind: ActivityInteractionKind;
  label: string;
};

export type ActivityOccurrence = {
  activityKind: string;
  activityId: string;
  occursAt: ActivityTemporalCoordinate | null;
  title: string;
  description: string | null;
  phase: "active" | "record";
  attributes: readonly ActivityOccurrenceAttribute[];
  interactions?: readonly ActivityInteractionRequest[];
};

export type ActivityRenderAction = {
  label: string;
  href: string;
  kind: "primary" | "secondary";
};

export type ActivityOccurrenceCapability = {
  resolve(activityId: string): Promise<Omit<ActivityOccurrence, "activityKind" | "activityId"> | null>;
  list?(): Promise<readonly string[]>;
};

export type ActivityTemporalCapability = {
  relevance(activityId: string): Promise<ActivityTemporalCoordinate | null>;
};

export type ActivityParticipationOfferReference = {
  activityKind: string;
  activityId: string;
  participationOfferId: string;
  procedureReference: string;
};

export type ActivityParticipationProjection = {
  title: string;
  attributes: readonly ActivityOccurrenceAttribute[];
};

export type ActivityParticipationCapability = {
  project(activityId: string, procedureReference: string): Promise<ActivityParticipationProjection | null>;
};

export type ActivityAssignment = {
  participationOfferId: string;
  attributes: readonly ActivityOccurrenceAttribute[];
};

export type ActivityAssignmentCapability = {
  project(activityId: string): Promise<readonly ActivityAssignment[]>;
};

export type ActivityInteractionCapability = {
  destination(kind: ActivityInteractionKind, activityId: string): string | null;
  availableTo?(kind: ActivityInteractionKind, activityId: string, guildieId: string | null): boolean | Promise<boolean>;
};

export type ActivityDiscovery = {
  title: string;
  tagline: string;
  destination: string;
};

export type ActivityAdministration = {
  capabilities?: readonly GuildCapabilityDefinition[];
};

export type ActivityRegistration = {
  kind: string;
  discovery?: ActivityDiscovery;
  administration?: ActivityAdministration;
  occurrence?: ActivityOccurrenceCapability;
  interaction?: ActivityInteractionCapability;
  kindInteraction?: ActivityKindInteractionCapability;
  participation?: ActivityParticipationCapability;
  assignment?: ActivityAssignmentCapability;
  workspace?: ActivityWorkspaceCapability;
};

export type ActivityActivationGate = {
  entitled?: () => boolean | Promise<boolean>;
  enabled?: () => boolean | Promise<boolean>;
};

export type ActivityRegistrationStatus = "active" | "unavailable" | "unentitled" | "disabled" | "failed";

export type ActivityRegistrationState = {
  kind: string;
  available: boolean;
  entitled: boolean | null;
  enabled: boolean | null;
  active: boolean;
  status: ActivityRegistrationStatus;
};

const activitiesByKind = new Map<string, ActivityRegistration>();
const activationByKind = new Map<string, ActivityActivationGate>();
const failedActivitiesByKind = new Set<string>();

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity ${field} is required`);
  return normalized;
}

export function registerActivity(input: ActivityRegistration): void {
  const kind = requiredText(input.kind, "kind");
  const existing = activitiesByKind.get(kind);
  if (existing && existing !== input) throw new Error(`Activity ${kind} is already registered`);


  if (input.administration?.capabilities?.length) {
    registerGuildCapabilityDefinitions(input.administration.capabilities);
  }

  activitiesByKind.set(kind, input);
}

export function markActivityActivationFailed(activityKind: string): void {
  failedActivitiesByKind.add(requiredText(activityKind, "kind"));
}

export function configureActivityActivation(activityKind: string, gate: ActivityActivationGate): void {
  const kind = requiredText(activityKind, "kind");
  if (!activitiesByKind.has(kind)) throw new Error(`Activity ${kind} must be registered before activation is configured`);
  activationByKind.set(kind, gate);
}

export async function activityRegistrationStates(): Promise<ActivityRegistrationState[]> {
  const known = await knownActivityPlugins();
  const kinds = new Set([...known.map((plugin) => plugin.kind), ...activitiesByKind.keys(), ...failedActivitiesByKind]);
  const states = await Promise.all([...kinds].map((kind) => activityRegistrationState(kind)));
  return states.filter((state): state is ActivityRegistrationState => state !== null);
}

export async function activityRegistrationState(activityKind: string): Promise<ActivityRegistrationState | null> {
  const kind = requiredText(activityKind, "kind");
  if (!activitiesByKind.has(kind)) {
    const known = await knownActivityPlugin(kind);
    return known ? { kind, available: false, entitled: null, enabled: null, active: false, status: "unavailable" } : null;
  }

  if (failedActivitiesByKind.has(kind)) {
    return { kind, available: true, entitled: null, enabled: null, active: false, status: "failed" };
  }

  const gate = activationByKind.get(kind);
  const [entitled, enabled] = await Promise.all([
    gate?.entitled ? gate.entitled() : true,
    gate?.enabled ? gate.enabled() : true,
  ]);

  const active = entitled && enabled;
  const status: ActivityRegistrationStatus = !entitled ? "unentitled" : !enabled ? "disabled" : "active";
  return { kind, available: true, entitled, enabled, active, status };
}

async function activeActivity(activityKind: string): Promise<ActivityRegistration | null> {
  const state = await activityRegistrationState(activityKind);
  return state?.active ? activitiesByKind.get(state.kind) ?? null : null;
}

export async function activityOccurrence(activityKind: string, activityId: string): Promise<ActivityOccurrence | null> {
  const kind = requiredText(activityKind, "kind");
  const id = requiredText(activityId, "id");
  const record = await activityRecord(kind, id);
  if (record) return record.occurrence;
  const activity = await activeActivity(kind);
  if (!activity?.occurrence) return null;
  const occurrence = await activity.occurrence.resolve(id);
  return occurrence ? { activityKind: kind, activityId: id, ...occurrence } : null;
}

export async function activityOccurrences(activityKind: string): Promise<readonly ActivityOccurrence[]> {
  const kind = requiredText(activityKind, "kind");
  const activity = await activeActivity(kind);
  if (!activity?.occurrence?.list) return [];

  const [liveIds, records] = await Promise.all([
    activity.occurrence.list(),
    activityRecords(kind),
  ]);
  const recordIds = new Set(records.map((record) => record.activityId));
  const liveOccurrences = await Promise.all(
    liveIds.filter((activityId) => !recordIds.has(activityId)).map((activityId) => activityOccurrence(kind, activityId)),
  );
  return [
    ...liveOccurrences.filter((occurrence): occurrence is ActivityOccurrence => occurrence !== null),
    ...records.map((record) => record.occurrence),
  ];
}

export async function activityKindRenderActions(
  activityKind: string,
  guildieId: string | null = null,
): Promise<readonly ActivityRenderAction[]> {
  const activity = await activeActivity(requiredText(activityKind, "kind"));
  if (!activity?.kindInteraction) return [];
  const kind: ActivityKindInteractionKind = "establish";
  const available = activity.kindInteraction.availableTo
    ? await activity.kindInteraction.availableTo(kind, guildieId)
    : true;
  if (!available) return [];
  const href = activity.kindInteraction.destination(kind);
  if (!href) return [];
  return [{ label: requiredText(activity.kindInteraction.label(kind), "kind interaction label"), href, kind: "primary" }];
}

export async function activityOccurrenceRenderActions(
  occurrence: ActivityOccurrence,
  guildieId: string | null = null,
): Promise<readonly ActivityRenderAction[]> {
  const activity = await activeActivity(occurrence.activityKind);
  if (!activity?.interaction) return [];

  const actions = await Promise.all((occurrence.interactions ?? []).map(async (request) => {
    const available = activity.interaction?.availableTo
      ? await activity.interaction.availableTo(request.kind, occurrence.activityId, guildieId)
      : true;
    if (!available) return null;

    const href = activity.interaction?.destination(request.kind, occurrence.activityId);
    if (!href) return null;
    return {
      label: requiredText(request.label, "interaction label"),
      href,
      kind: request.kind === "participate" ? "primary" as const : "secondary" as const,
    };
  }));

  return actions.filter((action): action is ActivityRenderAction => action !== null);
}

function calendarCoordinate(coordinate: ActivityTemporalCoordinate | null): ActivityCalendarCoordinate | null {
  if (coordinate === null) return null;
  const { start, end } = coordinate;
  if (start === null && end === null) {
    throw new Error("Activity temporal coordinate must have a start, an end, or both");
  }
  if (start !== null && end !== null) {
    if (end < start) throw new Error("Activity temporal coordinate end must not precede start");
    return start === end ? [start] : [start, end];
  }
  return [start ?? end!];
}

export async function activityTemporalProjection(
  activityKind: string,
  activityId: string,
): Promise<ActivityTemporalProjection | null> {
  const kind = requiredText(activityKind, "kind");
  const normalizedActivityId = requiredText(activityId, "id");
  const occurrence = await activityOccurrence(kind, normalizedActivityId);
  if (!occurrence) return null;

  return {
    activityKind: kind,
    activityId: normalizedActivityId,
    occursAt: calendarCoordinate(occurrence.occursAt),
  };
}


export async function activityAssignments(
  activityKind: string,
  activityId: string,
): Promise<readonly ActivityAssignment[]> {
  const activity = await activeActivity(requiredText(activityKind, "kind"));
  if (!activity?.assignment) return [];
  return activity.assignment.project(requiredText(activityId, "Assignment activity id"));
}

export async function activityWorkspace(
  activityKind: string,
  activityId: string,
): Promise<ActivityWorkspace | null> {
  const activity = await activeActivity(requiredText(activityKind, "kind"));
  if (!activity?.workspace) return null;
  return activity.workspace.project(requiredText(activityId, "Workspace activity id"));
}

export async function activityParticipationProjection(
  activityKind: string,
  activityId: string,
  procedureReference: string,
): Promise<ActivityParticipationProjection | null> {
  const activity = await activeActivity(requiredText(activityKind, "kind"));
  if (!activity?.participation) return null;
  return activity.participation.project(
    requiredText(activityId, "Participation activity id"),
    requiredText(procedureReference, "Participation procedure reference"),
  );
}

export async function activityParticipationOffersForIdentity(
  guildieId: string,
): Promise<Array<ActivityParticipationOfferReference & { procedureReference: string; destination: string }>> {
  const relationships = await participationOffersForIdentity(requiredText(guildieId, "participation identity id"));

  const resolved = await Promise.all(relationships.map(async (relationship) => {
    const activity = await activeActivity(relationship.activityKind);
    if (!activity) return null;

    const reference: ActivityParticipationOfferReference = {
      activityKind: relationship.activityKind,
      activityId: relationship.activityId,
      participationOfferId: relationship.participationOfferId,
      procedureReference: relationship.procedureReference,
    };
    return {
      ...reference,
      procedureReference: relationship.procedureReference,
      destination: `/activities/${encodeURIComponent(reference.activityKind)}/${encodeURIComponent(reference.activityId)}`,
    };
  }));

  return resolved.filter((reference): reference is ActivityParticipationOfferReference & { procedureReference: string; destination: string } => reference !== null);
}


export async function activityParticipationsForIdentity(
  guildieId: string,
): Promise<Array<{ participationId: string; activityKind: string; activityId: string; procedureReference: string; establishedAtUnix: number; destination: string }>> {
  const relationships = await participationsForIdentity(requiredText(guildieId, "Participation identity id"));

  const resolved = await Promise.all(relationships.map(async (relationship) => {
    const activity = await activeActivity(relationship.activityKind);
    if (!activity) return null;
    return {
      participationId: relationship.participationId,
      activityKind: relationship.activityKind,
      activityId: relationship.activityId,
      procedureReference: relationship.procedureReference,
      establishedAtUnix: relationship.establishedAtUnix,
      destination: `/activities/${encodeURIComponent(relationship.activityKind)}/${encodeURIComponent(relationship.activityId)}`,
    };
  }));

  return resolved.filter((reference): reference is NonNullable<typeof reference> => reference !== null);
}

export async function discoverableActivities(): Promise<readonly (ActivityDiscovery & { kind: string })[]> {
  const activities = await Promise.all([...activitiesByKind.values()].map(async (activity) => {
    if (!activity.discovery || !(await activeActivity(activity.kind))) return null;
    return { kind: activity.kind, ...activity.discovery };
  }));
  return activities.filter((activity): activity is ActivityDiscovery & { kind: string } => activity !== null);
}


export type ActivityAdministrationState = ActivityAdministration & { authoritative: boolean };

export async function activityAdministration(activityKind: string): Promise<ActivityAdministrationState | null> {
  const kind = requiredText(activityKind, "kind");
  const state = await activityRegistrationState(kind);
  if (!state) return null;
  const activity = activitiesByKind.get(kind);
  if (state.available && state.status !== "failed") return { ...(activity?.administration ?? {}), authoritative: true };
  const capabilities = await knownActivityCapabilityDeclarations(kind);
  return capabilities.length ? { capabilities, authoritative: false } : { authoritative: false };
}


export async function activityCapabilityDeclarationState(capability: string): Promise<{ activityKind: string; authoritative: boolean } | null> {
  const key = requiredText(capability, "capability");
  for (const state of await activityRegistrationStates()) {
    const administration = await activityAdministration(state.kind);
    if (administration?.capabilities?.some((definition) => definition.key === key)) {
      return { activityKind: state.kind, authoritative: administration.authoritative };
    }
  }
  return null;
}
