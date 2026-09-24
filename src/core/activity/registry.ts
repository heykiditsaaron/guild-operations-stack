export type ActivityTemporalRelevance = readonly [number] | readonly [number, number];

export type ActivityTemporalProjection = {
  activityKind: string;
  activityId: string;
  occursAt: ActivityTemporalRelevance | null;
};

export type ActivityTemporalCapability = {
  emissionCodes: readonly string[];
  projection(activityId: string): Promise<ActivityTemporalProjection>;
};

export type ActivityRegistration = {
  kind: string;
  temporal?: ActivityTemporalCapability;
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
