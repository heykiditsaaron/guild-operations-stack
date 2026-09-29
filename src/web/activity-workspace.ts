import type { ActivityOccurrence } from "../core/activity/registry.js";
import type { ActivityWorkspace, ActivityWorkspaceObject, ActivityWorkspacePlacement } from "../core/activity/presentation.js";
import { htmlText } from "./render.js";
import { renderActivityOccurrenceSharedValues, renderActivitySharedValues } from "./activity-values.js";

function attribute(object: ActivityWorkspaceObject, kind: string) {
  return object.attributes?.find((value) => value.kind === kind);
}

function placementAttribute(placement: ActivityWorkspacePlacement | undefined, kind: string) {
  return placement?.attributes?.find((value) => value.kind === kind);
}

async function participantCard(
  occurrence: Pick<ActivityOccurrence, "activityKind" | "activityId">,
  object: ActivityWorkspaceObject,
  placement: ActivityWorkspacePlacement | undefined,
): Promise<string> {
  const title = await renderActivityOccurrenceSharedValues(occurrence, object.value);
  const selectedSpec = placementAttribute(placement, "selected_spec");
  const offeredSpecs = attribute(object, "offered_specs");
  const detail = selectedSpec
    ? renderActivitySharedValues(selectedSpec.value)
    : offeredSpecs
      ? renderActivitySharedValues(offeredSpecs.value)
      : "";

  return `<article class="activity-workspace-card" data-activity-presentation="${htmlText(object.presentation)}" data-activity-workspace-object="${htmlText(object.id)}"><div class="activity-workspace-card-copy"><strong>${title}</strong>${detail ? `<span>${detail}</span>` : ""}</div></article>`;
}

export async function renderActivityWorkspace(
  occurrence: Pick<ActivityOccurrence, "activityKind" | "activityId">,
  workspace: ActivityWorkspace,
): Promise<string> {
  const placements = new Map(workspace.placements.map((placement) => [placement.objectId, placement]));
  const objects = new Map(workspace.objects.map((object) => [object.id, object]));
  const positions = await Promise.all(workspace.positions.map(async (position) => {
    const members = workspace.placements
      .filter((placement) => placement.positionId === position.id)
      .flatMap((placement) => {
        const object = objects.get(placement.objectId);
        return object ? [{ object, placement }] : [];
      });
    const cards = await Promise.all(members.map(({ object, placement }) => participantCard(occurrence, object, placement)));
    return `<section class="activity-workspace-position" data-activity-presentation="${htmlText(position.presentation)}" data-activity-workspace-position="${htmlText(position.id)}"><div class="activity-workspace-position-heading"><h3>${htmlText(position.label)}</h3><span>${members.length}</span></div><div class="activity-workspace-position-objects">${cards.length ? cards.join("") : `<p class="activity-workspace-empty">No participants.</p>`}</div></section>`;
  }));

  return `<section class="activity-workspace" data-activity-workspace="${htmlText(workspace.kind)}">${positions.join("")}</section>`;
}
