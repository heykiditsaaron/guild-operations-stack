import { activityParticipationsForGuildie } from "./participation.js";
import { knownActivityPlugin } from "./plugin-control.js";

export type ActivityTemporalRelevance = readonly [number] | readonly [number, number];

export type ActivityTemporalProjection = {
  activityKind: string;
  activityId: string;
  occursAt: ActivityTemporalRelevance | null;
};

export type ActivityPresentation = {
  title: string;
  description: string | null;
  category: string;
  publicAction: { label: string; href: string };
  participationAction: { label: string; href: string } | null;
  operationAction: { label: string; href: string };
};

export type ActivityTemporalCapability = {
  emissionCodes: readonly string[];
  projection(activityId: string): Promise<ActivityTemporalProjection>;
  presentation(activityId: string): Promise<ActivityPresentation | null>;
};

export type ActivityParticipationReference = {
  activityKind: string;
  activityId: string;
  participationId: string;
};

export type ActivityParticipationCapability = {
  destination(reference: ActivityParticipationReference): string;
};

export type ActivityDiscovery = {
  title: string;
  tagline: string;
  destination: string;
};

export type ActivityRegistration = {
  kind: string;
  discovery?: ActivityDiscovery;
  temporal?: ActivityTemporalCapability;
  participation?: ActivityParticipationCapability;
};

export type ActivityActivationGate = {
  entitled?: () => boolean | Promise<boolean>;
  enabled?: () => boolean | Promise<boolean>;
};

export type ActivityRegistrationState = {
  kind: string;
  available: boolean;
  entitled: boolean;
  enabled: boolean;
  active: boolean;
};

const activitiesByKind = new Map<string, ActivityRegistration>();
const activationByKind = new Map<string, ActivityActivationGate>();
const activitiesByTemporalEmissionCode = new Map<string, ActivityRegistration>();

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity ${field} is required`);
  return normalized;
}

export function registerActivity(input: ActivityRegistration): void {
  const kind = requiredText(input.kind, "kind");
  const existing = activitiesByKind.get(kind);
  if (existing && existing !== input) throw new Error(`Activity ${kind} is already registered`);

  if (input.temporal) {
    if (!input.temporal.emissionCodes.length) {
      throw new Error(`Activity ${kind} temporal capability must declare emission codes`);
    }
    for (const codeInput of input.temporal.emissionCodes) {
      const code = requiredText(codeInput, "temporal emission code");
      const registered = activitiesByTemporalEmissionCode.get(code);
      if (registered && registered !== input) {
        throw new Error(`Activity temporal emission ${code} is already registered by ${registered.kind}`);
      }
    }
  }

  activitiesByKind.set(kind, input);
  for (const codeInput of input.temporal?.emissionCodes ?? []) {
    activitiesByTemporalEmissionCode.set(codeInput.trim(), input);
  }
}

export function configureActivityActivation(activityKind: string, gate: ActivityActivationGate): void {
  const kind = requiredText(activityKind, "kind");
  if (!activitiesByKind.has(kind)) throw new Error(`Activity ${kind} must be registered before activation is configured`);
  activationByKind.set(kind, gate);
}

export async function activityRegistrationState(activityKind: string): Promise<ActivityRegistrationState | null> {
  const kind = requiredText(activityKind, "kind");
  if (!activitiesByKind.has(kind)) {
    const known = await knownActivityPlugin(kind);
    return known ? { kind, available: false, entitled: false, enabled: false, active: false } : null;
  }

  const gate = activationByKind.get(kind);
  const [entitled, enabled] = await Promise.all([
    gate?.entitled ? gate.entitled() : true,
    gate?.enabled ? gate.enabled() : true,
  ]);

  return { kind, available: true, entitled, enabled, active: entitled && enabled };
}

async function activeActivity(activityKind: string): Promise<ActivityRegistration | null> {
  const state = await activityRegistrationState(activityKind);
  return state?.active ? activitiesByKind.get(state.kind) ?? null : null;
}

export async function activityPresentation(activityKind: string, activityId: string): Promise<ActivityPresentation | null> {
  const activity = await activeActivity(requiredText(activityKind, "kind"));
  if (!activity?.temporal) return null;
  return activity.temporal.presentation(requiredText(activityId, "id"));
}

export function activityTemporalEmissionCodes(): readonly string[] {
  return [...activitiesByTemporalEmissionCode.keys()];
}

export async function activityTemporalProjectionForEmission(
  code: string,
  activityId: string,
): Promise<ActivityTemporalProjection | null> {
  const registered = activitiesByTemporalEmissionCode.get(code);
  if (!registered?.temporal) return null;
  const activity = await activeActivity(registered.kind);
  if (!activity?.temporal) return null;

  const projection = await activity.temporal.projection(activityId);
  if (projection.activityKind !== activity.kind) {
    throw new Error(
      `Activity temporal projection kind ${projection.activityKind} does not match registered kind ${activity.kind}`,
    );
  }
  if (projection.activityId !== activityId) {
    throw new Error(
      `Activity temporal projection id ${projection.activityId} does not match emission subject ${activityId}`,
    );
  }
  return projection;
}


export async function activityParticipationForGuildie(
  guildieId: string,
): Promise<Array<ActivityParticipationReference & { destination: string }>> {
  const relationships = await activityParticipationsForGuildie(requiredText(guildieId, "participation Guildie id"));

  const resolved = await Promise.all(relationships.map(async (relationship) => {
    const activity = await activeActivity(relationship.activityKind);
    if (!activity?.participation) return null;

    const reference: ActivityParticipationReference = {
      activityKind: relationship.activityKind,
      activityId: relationship.activityId,
      participationId: relationship.participationId,
    };
    return { ...reference, destination: activity.participation.destination(reference) };
  }));

  return resolved.filter((reference): reference is ActivityParticipationReference & { destination: string } => reference !== null);
}

export async function discoverableActivities(): Promise<readonly (ActivityDiscovery & { kind: string })[]> {
  const activities = await Promise.all([...activitiesByKind.values()].map(async (activity) => {
    if (!activity.discovery || !(await activeActivity(activity.kind))) return null;
    return { kind: activity.kind, ...activity.discovery };
  }));
  return activities.filter((activity): activity is ActivityDiscovery & { kind: string } => activity !== null);
}
