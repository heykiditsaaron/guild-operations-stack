import type { ParticipationOfferWorkspace, ParticipationOfferWorkspaceRequest } from "../core/activity/participation.js";
import type { ActivitySharedValue } from "../core/activity/registry.js";
import { allWowClassTraitDefinitions, specsForClass } from "../wow-traits/registry.js";
import { htmlText } from "./render.js";

function jsonScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function isSharedValue(value: ActivitySharedValue | readonly ActivitySharedValue[]): value is ActivitySharedValue {
  return !Array.isArray(value);
}

function requestLabel(name: string): string {
  return name.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function integerRequest(request: ParticipationOfferWorkspaceRequest): string {
  if (request.request.kind !== "integer") return "";
  const constraints = request.request;
  const minimum = constraints.greaterThan !== undefined
    ? constraints.greaterThan + 1
    : constraints.greaterThanOrEqual;
  const maximum = constraints.lessThan !== undefined
    ? constraints.lessThan - 1
    : constraints.lessThanOrEqual;
  const current = request.currentValue && isSharedValue(request.currentValue) && request.currentValue.type === "integer"
    ? request.currentValue.value
    : "";
  return `<label class="participation-offer-workspace-field"><span>${htmlText(requestLabel(constraints.name))}</span><input type="number" step="1" data-participation-integer${minimum !== undefined ? ` min="${minimum}"` : ""}${maximum !== undefined ? ` max="${maximum}"` : ""}${current !== "" ? ` value="${current}" data-participation-retained-value="${current}"` : ""}></label>`;
}

function characterOptions(request: ParticipationOfferWorkspaceRequest): string {
  if (request.acquisition.kind !== "guild_character") return "";
  return request.acquisition.characters.map((character) =>
    `<option value="${htmlText(JSON.stringify({ realmId: character.realmId, characterId: character.characterId }))}">${htmlText(character.name)}${character.realmName ? ` · ${htmlText(character.realmName)}` : ""}</option>`
  ).join("");
}

function guildCharacterRequest(request: ParticipationOfferWorkspaceRequest): string {
  if (request.request.kind !== "guild_character" || request.acquisition.kind !== "guild_character") return "";
  const current = request.currentValue && isSharedValue(request.currentValue) && request.currentValue.type === "guild_character"
    ? JSON.stringify({ realmId: request.currentValue.value.realmId, characterId: request.currentValue.value.characterId })
    : "";
  return `<label class="participation-offer-workspace-field"><span>${htmlText(requestLabel(request.request.name))}</span><select data-participation-guild-character><option value="">Select a character…</option>${characterOptions(request)}</select></label>${current ? `<script type="application/json" data-participation-current-character>${jsonScript({ value: JSON.parse(current), retain: 0 })}</script>` : ""}`;
}

function wowSpecRequest(request: ParticipationOfferWorkspaceRequest): string {
  if (request.request.kind !== "wow_spec" || request.acquisition.kind !== "wow_spec") return "";
  const classes = allWowClassTraitDefinitions().map((definition) => definition.className);
  const characters = request.acquisition.characters.map((character) =>
    `<option value="${htmlText(JSON.stringify({ region: character.region, realmId: character.realmId, characterId: character.characterId }))}" data-class-name="${htmlText(character.className ?? "")}">${htmlText(character.name)}${character.className ? ` · ${htmlText(character.className)}` : ""}${character.realmName ? ` · ${htmlText(character.realmName)}` : ""}</option>`
  ).join("");
  const declared = request.acquisition.allowDeclaredClass
    ? classes.map((className) => `<option value="${htmlText(className)}">${htmlText(className)}</option>`).join("")
    : "";
  const specs = classes.flatMap((className) => specsForClass(className).map((specName) =>
    `<option value="${htmlText(specName)}" data-class-name="${htmlText(className)}">${htmlText(specName)}</option>`
  )).join("");
  const current = request.currentValue === null
    ? []
    : Array.isArray(request.currentValue) ? request.currentValue : [request.currentValue];
  const currentSpecs = current.flatMap((value, index) =>
    value.type === "wow_spec" ? [{ ...value.value, retain: index }] : []
  );

  return `<div class="participation-offer-workspace-field" data-participation-wow-spec>
    <span>${htmlText(requestLabel(request.request.name))}</span>
    <div data-participation-values></div>
    <div class="participation-offer-workspace-acquisition">
      ${characters ? `<label><span>Character</span><select data-participation-spec-character><option value="">Select a character…</option>${characters}</select></label>` : ""}
      ${declared ? `<label><span>Class</span><select data-participation-spec-class><option value="">Select a class…</option>${declared}</select></label>` : ""}
      <label><span>Specialization</span><select data-participation-spec-name disabled><option value="">Select a specialization…</option>${specs}</select></label>
      <button type="button" class="button-secondary" data-participation-add-value>Add</button>
    </div>
    <script type="application/json" data-participation-current-values>${jsonScript(currentSpecs)}</script>
  </div>`;
}

function renderRequest(request: ParticipationOfferWorkspaceRequest, label?: string): string {
  const body = request.request.kind === "integer"
    ? integerRequest(request)
    : request.request.kind === "guild_character"
      ? guildCharacterRequest(request)
      : wowSpecRequest(request);
  const rendered = label ? body.replace(`<span>${htmlText(requestLabel(request.request.name))}</span>`, `<span>${htmlText(label)}</span>`) : body;
  return `<section class="participation-offer-workspace-request" data-participation-request data-name="${htmlText(request.request.name)}" data-kind="${htmlText(request.request.kind)}" data-allow-multiple="${request.request.allowMultiple ? "true" : "false"}">${rendered}</section>`;
}

export function renderParticipationOfferWorkspace(
  workspace: ParticipationOfferWorkspace,
  input: { action: string; labels?: Readonly<Record<string, string>> },
): string {
  const revising = workspace.requests.some((request) => request.currentValue !== null);
  return `<section class="participation-offer-workspace" data-participation-offer-workspace>
    <header class="participation-offer-workspace-header"><h2>${revising ? "Revise participation offer" : "Offer participation"}</h2></header>
    <form data-participation-offer-form data-action="${htmlText(input.action)}">
      ${workspace.requests.map((request) => renderRequest(request, input.labels?.[request.request.name])).join("")}
      <div class="participation-offer-workspace-actions"><button type="submit" class="button-primary">${revising ? "Update offer" : "Establish offer"}</button></div>
      <p data-participation-offer-status role="status" aria-live="polite"></p>
    </form>
  </section>`;
}
