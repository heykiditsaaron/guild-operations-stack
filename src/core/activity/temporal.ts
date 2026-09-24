export type ActivityTemporalRelevance = readonly [number] | readonly [number, number];

export type ActivityTemporalProjection = {
  activityKind: string;
  activityId: string;
  occursAt: ActivityTemporalRelevance | null;
};

export type ActivityTemporalIntegration = {
  activityKind: string;
  emissionCodes: readonly string[];
  temporalProjection(activityId: string): Promise<ActivityTemporalProjection>;
};

const integrationsByKind = new Map<string, ActivityTemporalIntegration>();
const integrationsByEmissionCode = new Map<string, ActivityTemporalIntegration>();

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity ${field} is required`);
  return normalized;
}

export function registerActivityTemporalIntegration(input: ActivityTemporalIntegration): void {
  const activityKind = requiredText(input.activityKind, "kind");
  if (!input.emissionCodes.length) throw new Error(`Activity ${activityKind} must declare temporal emission codes`);

  const existingKind = integrationsByKind.get(activityKind);
  if (existingKind && existingKind !== input) {
    throw new Error(`Activity temporal integration is already registered for ${activityKind}`);
  }

  for (const codeInput of input.emissionCodes) {
    const code = requiredText(codeInput, "emission code");
    const existingCode = integrationsByEmissionCode.get(code);
    if (existingCode && existingCode !== input) {
      throw new Error(`Activity temporal emission ${code} is already registered by ${existingCode.activityKind}`);
    }
  }

  integrationsByKind.set(activityKind, input);
  for (const codeInput of input.emissionCodes) {
    integrationsByEmissionCode.set(codeInput.trim(), input);
  }
}

export function activityTemporalEmissionCodes(): readonly string[] {
  return [...integrationsByEmissionCode.keys()];
}

export async function activityTemporalProjectionForEmission(
  code: string,
  activityId: string,
): Promise<ActivityTemporalProjection | null> {
  const integration = integrationsByEmissionCode.get(code);
  if (!integration) return null;

  const projection = await integration.temporalProjection(activityId);
  if (projection.activityKind !== integration.activityKind) {
    throw new Error(
      `Activity temporal projection kind ${projection.activityKind} does not match registered kind ${integration.activityKind}`,
    );
  }
  if (projection.activityId !== activityId) {
    throw new Error(
      `Activity temporal projection id ${projection.activityId} does not match emission subject ${activityId}`,
    );
  }
  return projection;
}
