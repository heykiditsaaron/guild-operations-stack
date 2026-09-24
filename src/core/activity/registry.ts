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
  forGuildie(guildieId: string): Promise<readonly ActivityParticipationReference[]>;
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

const activitiesByKind = new Map<string, ActivityRegistration>();
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

export async function activityPresentation(activityKind: string, activityId: string): Promise<ActivityPresentation | null> {
  const activity = activitiesByKind.get(requiredText(activityKind, "kind"));
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
  const activity = activitiesByTemporalEmissionCode.get(code);
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
  const normalizedGuildieId = requiredText(guildieId, "participation Guildie id");
  const participating = [...activitiesByKind.values()].filter(
    (activity): activity is ActivityRegistration & { participation: ActivityParticipationCapability } =>
      activity.participation !== undefined,
  );

  const resolved = await Promise.all(
    participating.map(async (activity) => {
      const references = await activity.participation.forGuildie(normalizedGuildieId);
      for (const reference of references) {
        if (reference.activityKind !== activity.kind) {
          throw new Error(
            `Activity participation kind ${reference.activityKind} does not match registered kind ${activity.kind}`,
          );
        }
        requiredText(reference.activityId, "participation activity id");
        requiredText(reference.participationId, "participation id");
      }
      return references.map((reference) => ({
        ...reference,
        destination: activity.participation.destination(reference),
      }));
    }),
  );

  return resolved.flat();
}

export function discoverableActivities(): readonly (ActivityDiscovery & { kind: string })[] {
  return [...activitiesByKind.values()].flatMap((activity) => activity.discovery ? [{ kind: activity.kind, ...activity.discovery }] : []);
}
