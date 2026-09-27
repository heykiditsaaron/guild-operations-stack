import type { PoolClient } from "pg";
import { publishEmission, type EmissionPublication } from "../../emissions/registry.js";

export const ACTIVITY_TEMPORAL_RELEVANCE_CHANGED = "activity.temporal-relevance.changed";

export type ActivityDeclaration =
  | { kind: "temporal-relevance-changed"; activityKind: string; activityId: string };

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity declaration ${field} is required`);
  return normalized;
}

export async function publishActivityDeclaration(
  client: PoolClient,
  declaration: ActivityDeclaration,
): Promise<EmissionPublication> {
  const activityKind = requiredText(declaration.activityKind, "activity kind");
  const activityId = requiredText(declaration.activityId, "activity id");

  if (declaration.kind === "temporal-relevance-changed") {
    return publishEmission(client, {
      code: ACTIVITY_TEMPORAL_RELEVANCE_CHANGED,
      parent: activityKind,
      subject: activityId,
    });
  }

  const exhaustive: never = declaration;
  throw new Error(`Unsupported Activity declaration ${String(exhaustive)}`);
}
