import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import { controlledCharacterRecordIdsForIdentity } from "../identity/controlled-characters.js";
import { controlledGuildMemberCharacters } from "../guild/guild-characters.js";
import { characterProjections } from "../identity/character-projection.js";
import { effectiveGuildAuthority } from "../authority/guild-permissions.js";
import { specsForClass } from "../../wow-traits/registry.js";
import type { ActivitySharedValue } from "./registry.js";

export type ActivityParticipationActor =
  | { kind: "native"; reference: string }
  | { kind: "external"; reference: string };

export type ActivityParticipationParty = ActivityParticipationActor;

export type ActivityParticipationContextItem = {
  name: string;
  value: ActivitySharedValue | readonly ActivitySharedValue[];
};

export type ActivityParticipationOffer = {
  participationOfferId: string;
  activityKind: string;
  activityId: string;
  actor: ActivityParticipationActor;
  context: readonly ActivityParticipationContextItem[];
  procedureReference: string;
  offeredAtUnix: number;
  revokedAtUnix: number | null;
  closedAtUnix: number | null;
};

export type OfferActivityParticipationInput = {
  activityKind: string;
  activityId: string;
  actor: ActivityParticipationActor;
  context?: readonly ActivityParticipationContextItem[];
  procedureReference: string;
  offeredAtUnix?: number;
};

export type ActivityParticipationContextRequest =
  | {
      name: string;
      kind: "integer";
      allowMultiple: boolean;
      greaterThan?: number;
      greaterThanOrEqual?: number;
      lessThan?: number;
      lessThanOrEqual?: number;
    }
  | { name: string; kind: "string"; allowMultiple: boolean; maxLength?: number }
  | { name: string; kind: "guild_character"; allowMultiple: boolean }
  | { name: string; kind: "wow_spec"; allowMultiple: boolean };

export type ActivityParticipationEligibility =
  | { kind: "any" }
  | { kind: "guildie"; guildId: string }
  | { kind: "guild_member_character"; guildId: string };

export type ActivityParticipationOfferContract = {
  context: readonly ActivityParticipationContextRequest[];
};

export type ParticipationOfferWorkspaceCharacter = {
  characterRecordId: string;
  region: string;
  realmId: string;
  characterId: string;
  name: string;
  realmName: string | null;
  className: string | null;
};

export type ParticipationOfferWorkspaceAcquisition =
  | { kind: "integer" }
  | { kind: "string" }
  | { kind: "guild_character"; characters: readonly ParticipationOfferWorkspaceCharacter[] }
  | {
      kind: "wow_spec";
      characters: readonly ParticipationOfferWorkspaceCharacter[];
      allowDeclaredClass: boolean;
    };

export type ParticipationOfferWorkspaceRequest = {
  request: ActivityParticipationContextRequest;
  currentValue: ActivitySharedValue | readonly ActivitySharedValue[] | null;
  acquisition: ParticipationOfferWorkspaceAcquisition;
};

export type ParticipationOfferWorkspace = {
  actor: ActivityParticipationActor;
  requests: readonly ParticipationOfferWorkspaceRequest[];
  complete: boolean;
};

export class ActivityParticipationOfferError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = "ActivityParticipationOfferError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Activity Participation ${field} is required`);
  return normalized;
}

function mapParticipationOffer(row: {
  participation_offer_id: string;
  activity_kind: string;
  activity_id: string;
  party_kind: "native" | "external";
  party_reference: string;
  context: unknown;
  procedure_reference: string;
  offered_at_unix: string | number;
  revoked_at_unix: string | number | null;
  closed_at_unix: string | number | null;
}): ActivityParticipationOffer {
  return {
    participationOfferId: row.participation_offer_id,
    activityKind: row.activity_kind,
    activityId: row.activity_id,
    actor: { kind: row.party_kind, reference: row.party_reference },
    context: Array.isArray(row.context) ? row.context as ActivityParticipationContextItem[] : [],
    procedureReference: row.procedure_reference,
    offeredAtUnix: Number(row.offered_at_unix),
    revokedAtUnix: row.revoked_at_unix === null ? null : Number(row.revoked_at_unix),
    closedAtUnix: row.closed_at_unix === null ? null : Number(row.closed_at_unix),
  };
}

export async function offerActivityParticipation(
  client: PoolClient,
  input: OfferActivityParticipationInput,
): Promise<ActivityParticipationOffer> {
  const activityKind = requiredText(input.activityKind, "Offer kind");
  const activityId = requiredText(input.activityId, "Offer activity id");
  const actorReference = requiredText(input.actor.reference, "Offer actor reference");
  const procedureReference = requiredText(input.procedureReference, "Offer procedure reference");
  const offeredAtUnix = input.offeredAtUnix ?? Math.floor(Date.now() / 1000);
  const context = input.context ?? [];

  const inserted = await client.query<any>(
    `INSERT INTO activity_participation_offers (
       activity_kind, activity_id, party_kind, party_reference, context, procedure_reference, offered_at_unix
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
     ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING
     RETURNING *`,
    [activityKind, activityId, input.actor.kind, actorReference, JSON.stringify(context), procedureReference, offeredAtUnix],
  );

  if (inserted.rowCount) return mapParticipationOffer(inserted.rows[0]);

  const existing = await client.query<any>(
    `SELECT * FROM activity_participation_offers
      WHERE activity_kind=$1 AND activity_id=$2 AND procedure_reference=$3`,
    [activityKind, activityId, procedureReference],
  );
  const offer = existing.rows[0];
  if (!offer) throw new Error("Activity Participation Offer could not be reloaded");
  if (offer.party_kind !== input.actor.kind || offer.party_reference !== actorReference) {
    throw new Error("Activity Participation Offer procedure reference belongs to a different actor");
  }
  if (JSON.stringify(offer.context ?? []) !== JSON.stringify(context)) {
    throw new Error("Activity Participation Offer procedure reference belongs to different procedure context");
  }
  if (offer.revoked_at_unix !== null || offer.closed_at_unix !== null) {
    throw new Error("Settled Activity Participation Offer cannot be offered again through the same procedure reference");
  }
  return mapParticipationOffer(offer);
}


function contextName(value: string): string {
  return requiredText(value, "Offer context name");
}

function requireIntegerContextValue(
  request: Extract<ActivityParticipationContextRequest, { kind: "integer" }>,
  raw: unknown,
): ActivitySharedValue {
  if (!Number.isSafeInteger(raw)) {
    throw new ActivityParticipationOfferError("invalid_integer", `${request.name} must be an integer`);
  }
  const value = raw as number;
  if (request.greaterThan !== undefined && !(value > request.greaterThan)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.name} must be greater than ${request.greaterThan}`);
  }
  if (request.greaterThanOrEqual !== undefined && !(value >= request.greaterThanOrEqual)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.name} must be at least ${request.greaterThanOrEqual}`);
  }
  if (request.lessThan !== undefined && !(value < request.lessThan)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.name} must be less than ${request.lessThan}`);
  }
  if (request.lessThanOrEqual !== undefined && !(value <= request.lessThanOrEqual)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.name} must be at most ${request.lessThanOrEqual}`);
  }
  return { type: "integer", value };
}

function requireStringContextValue(
  request: Extract<ActivityParticipationContextRequest, { kind: "string" }>,
  raw: unknown,
): ActivitySharedValue {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new ActivityParticipationOfferError("invalid_string", `${request.name} must be nonempty text`);
  }
  const value = raw.trim();
  if (request.maxLength !== undefined && value.length > request.maxLength) {
    throw new ActivityParticipationOfferError("string_too_long", `${request.name} must be at most ${request.maxLength} characters`);
  }
  return { type: "string", value };
}

type WowSpecParticipationAcquisition = {
  characters: readonly ParticipationOfferWorkspaceCharacter[];
  allowDeclaredClass: boolean;
  characterSource: "controlled_character" | "controlled_guild_character" | null;
};

async function wowSpecParticipationAcquisition(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
): Promise<WowSpecParticipationAcquisition> {
  if (actor.kind === "external") {
    return {
      characters: [],
      allowDeclaredClass: eligibility.kind === "any",
      characterSource: null,
    };
  }

  const characterSource = eligibility.kind === "guild_member_character"
    ? "controlled_guild_character" as const
    : "controlled_character" as const;
  const characterRecordIds = characterSource === "controlled_guild_character"
    ? (await controlledGuildMemberCharacters(actor.reference)).map((character) => character.characterRecordId)
    : await controlledCharacterRecordIdsForIdentity(actor.reference);
  const characters = await characterProjections(characterRecordIds);
  return {
    characters: characters.map(participationOfferWorkspaceCharacter),
    allowDeclaredClass: eligibility.kind === "any",
    characterSource,
  };
}

async function requireWowSpecContextValue(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
  request: Extract<ActivityParticipationContextRequest, { kind: "wow_spec" }>,
  raw: unknown,
): Promise<ActivitySharedValue> {
  const acquisition = await wowSpecParticipationAcquisition(actor, eligibility);

  if (typeof raw !== "object" || raw === null) {
    throw new ActivityParticipationOfferError("invalid_wow_spec", `${request.name} contains an invalid specialization choice`);
  }
  const candidate = raw as {
    specName?: unknown;
    character?: { region?: unknown; realmId?: unknown; characterId?: unknown };
    className?: unknown;
  };
  if (typeof candidate.specName !== "string" || !candidate.specName.trim()) {
    throw new ActivityParticipationOfferError("invalid_wow_spec", `${request.name} contains an invalid specialization choice`);
  }

  let className: string;
  if (candidate.character) {
    if (actor.kind !== "native") {
      throw new ActivityParticipationOfferError("wow_spec_requires_native_identity", `${request.name} must resolve Character provenance through a native identity`);
    }
    const coordinate = candidate.character;
    if (typeof coordinate.region !== "string" || typeof coordinate.realmId !== "string" || typeof coordinate.characterId !== "string") {
      throw new ActivityParticipationOfferError("invalid_wow_spec", `${request.name} contains an invalid Character reference`);
    }
    const source = acquisition.characterSource;
    if (!source) {
      throw new ActivityParticipationOfferError("wow_spec_fulfillment_unavailable", `${request.name} does not permit Character-derived class provenance`, 403);
    }
    const character = acquisition.characters.find((value) =>
      value.region === coordinate.region && value.realmId === coordinate.realmId && value.characterId === coordinate.characterId
    );
    if (!character) {
      throw new ActivityParticipationOfferError(
        "wow_spec_identity_unavailable",
        source === "controlled_guild_character"
          ? `${request.name} must resolve through currently controlled Characters on the current guild roster`
          : `${request.name} must resolve through currently controlled Characters`,
        403,
      );
    }
    if (!character.className) throw new ActivityParticipationOfferError("wow_spec_class_unavailable", "Character class facts are not available");
    className = character.className;
  } else {
    if (!acquisition.allowDeclaredClass) {
      throw new ActivityParticipationOfferError("wow_spec_fulfillment_unavailable", `${request.name} does not permit declared class provenance`, 403);
    }
    if (typeof candidate.className !== "string" || !candidate.className.trim()) {
      throw new ActivityParticipationOfferError("invalid_wow_spec", `${request.name} requires a class for each declared specialization`);
    }
    className = candidate.className.trim();
  }

  const specName = candidate.specName.trim();
  const canonical = specsForClass(className)
    .find((value) => value.toLocaleLowerCase("en-US") === specName.toLocaleLowerCase("en-US"));
  if (!canonical) throw new ActivityParticipationOfferError("invalid_wow_spec", `Unknown class/specialization combination: ${className} / ${specName}`);
  return { type: "wow_spec", value: { className, specName: canonical } };
}

async function guildCharacterParticipationAcquisition(
  actor: ActivityParticipationActor,
): Promise<readonly ParticipationOfferWorkspaceCharacter[]> {
  if (actor.kind !== "native") return [];
  const characterRecordIds = (await controlledGuildMemberCharacters(actor.reference))
    .map((character) => character.characterRecordId);
  return (await characterProjections(characterRecordIds))
    .map(participationOfferWorkspaceCharacter);
}

async function requireGuildCharacterContextValue(
  actor: ActivityParticipationActor,
  request: Extract<ActivityParticipationContextRequest, { kind: "guild_character" }>,
  raw: unknown,
): Promise<ActivitySharedValue> {
  if (actor.kind !== "native") {
    throw new ActivityParticipationOfferError("guild_character_requires_native_identity", "A guild Character must be offered by a native identity");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new ActivityParticipationOfferError("invalid_guild_character", `${request.name} must identify a guild Character`);
  }
  const candidate = raw as { realmId?: unknown; characterId?: unknown };
  if (typeof candidate.realmId !== "string" || typeof candidate.characterId !== "string") {
    throw new ActivityParticipationOfferError("invalid_guild_character", `${request.name} must identify a guild Character`);
  }

  const character = (await guildCharacterParticipationAcquisition(actor))
    .find((item) => item.realmId === candidate.realmId && item.characterId === candidate.characterId);
  if (!character) {
    throw new ActivityParticipationOfferError(
      "guild_character_unavailable",
      `${request.name} must be a currently controlled Character on the current guild roster`,
      403,
    );
  }

  return {
    type: "guild_character",
    value: {
      characterRecordId: character.characterRecordId,
      region: character.region,
      realmId: character.realmId,
      characterId: character.characterId,
      name: character.name,
    },
  };
}

async function constructParticipationContextValue(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
  request: ActivityParticipationContextRequest,
  raw: unknown,
): Promise<ActivitySharedValue> {
  if (request.kind === "integer") return requireIntegerContextValue(request, raw);
  if (request.kind === "string") return requireStringContextValue(request, raw);
  if (request.kind === "wow_spec") return requireWowSpecContextValue(actor, eligibility, request, raw);
  return requireGuildCharacterContextValue(actor, request, raw);
}

async function constructParticipationContextItem(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
  request: ActivityParticipationContextRequest,
  raw: unknown,
): Promise<ActivityParticipationContextItem> {
  const name = contextName(request.name);
  if (!request.allowMultiple) {
    if (Array.isArray(raw)) {
      throw new ActivityParticipationOfferError("invalid_context_multiplicity", `${name} accepts exactly one value`);
    }
    return { name, value: await constructParticipationContextValue(actor, eligibility, request, raw) };
  }

  if (!Array.isArray(raw) || !raw.length) {
    throw new ActivityParticipationOfferError("invalid_context_multiplicity", `${name} requires one or more values`);
  }
  const values = await Promise.all(raw.map((value) =>
    constructParticipationContextValue(actor, eligibility, request, value)
  ));
  return { name, value: values };
}

function retainedParticipationContextValue(
  request: ActivityParticipationContextRequest,
  existing: ActivityParticipationContextItem | undefined,
  index: number,
): ActivitySharedValue {
  const values = existing === undefined
    ? []
    : Array.isArray(existing.value) ? existing.value : [existing.value];
  const value = values[index];
  if (!value) {
    throw new ActivityParticipationOfferError("invalid_retained_context", `${request.name} no longer contains that established value`);
  }
  if (request.kind === "integer") {
    if (value.type !== "integer") throw new ActivityParticipationOfferError("invalid_retained_context", `${request.name} contains an invalid established value`);
    return requireIntegerContextValue(request, value.value);
  }
  if (request.kind === "string") {
    if (value.type !== "string") throw new ActivityParticipationOfferError("invalid_retained_context", `${request.name} contains an invalid established value`);
    return requireStringContextValue(request, value.value);
  }
  if (request.kind === "guild_character") {
    if (value.type !== "guild_character") throw new ActivityParticipationOfferError("invalid_retained_context", `${request.name} contains an invalid established value`);
    return value;
  }
  if (value.type !== "wow_spec") {
    throw new ActivityParticipationOfferError("invalid_retained_context", `${request.name} contains an invalid established value`);
  }
  const canonical = specsForClass(value.value.className)
    .find((specName) => specName.toLocaleLowerCase("en-US") === value.value.specName.toLocaleLowerCase("en-US"));
  if (!canonical) throw new ActivityParticipationOfferError("invalid_retained_context", `${request.name} contains an unknown established specialization`);
  return { type: "wow_spec", value: { className: value.value.className, specName: canonical } };
}

function retainedContextIndex(raw: unknown): number | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const candidate = raw as { retain?: unknown };
  return Number.isSafeInteger(candidate.retain) && (candidate.retain as number) >= 0
    ? candidate.retain as number
    : null;
}

async function constructParticipationRevisionContextItem(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
  request: ActivityParticipationContextRequest,
  existing: ActivityParticipationContextItem | undefined,
  raw: unknown,
): Promise<ActivityParticipationContextItem> {
  const name = contextName(request.name);
  const constructValue = async (candidate: unknown): Promise<ActivitySharedValue> => {
    const retainedIndex = retainedContextIndex(candidate);
    return retainedIndex === null
      ? constructParticipationContextValue(actor, eligibility, request, candidate)
      : retainedParticipationContextValue(request, existing, retainedIndex);
  };

  if (!request.allowMultiple) {
    if (Array.isArray(raw)) {
      throw new ActivityParticipationOfferError("invalid_context_multiplicity", `${name} accepts exactly one value`);
    }
    return { name, value: await constructValue(raw) };
  }
  if (!Array.isArray(raw) || !raw.length) {
    throw new ActivityParticipationOfferError("invalid_context_multiplicity", `${name} requires one or more values`);
  }
  return { name, value: await Promise.all(raw.map(constructValue)) };
}

async function validateParticipationOfferActor(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
): Promise<void> {
  if (eligibility.kind === "any") return;
  if (actor.kind !== "native") {
    throw new ActivityParticipationOfferError("actor_ineligible", "Participation Offer actor does not satisfy occurrence eligibility", 403);
  }
  if (!await effectiveGuildAuthority(actor.reference, eligibility.guildId)) {
    throw new ActivityParticipationOfferError("actor_ineligible", "Participation Offer actor is not a current Guildie", 403);
  }
}

async function constructParticipationContext(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
  contract: ActivityParticipationOfferContract,
  supplied: Readonly<Record<string, unknown>>,
): Promise<ActivityParticipationContextItem[]> {
  const requests = contract.context;
  const names = requests.map((request) => contextName(request.name));
  if (new Set(names).size !== names.length) throw new Error("Activity Participation Offer context names must be unique");
  const unexpected = Object.keys(supplied).filter((name) => !names.includes(name));
  if (unexpected.length) throw new ActivityParticipationOfferError("unexpected_context", `Participation Offer does not accept context ${unexpected[0]}`);
  return Promise.all(requests.map(async (request) => {
    if (!Object.prototype.hasOwnProperty.call(supplied, request.name)) {
      throw new ActivityParticipationOfferError("missing_context", `Participation Offer requires context ${request.name}`);
    }
    return constructParticipationContextItem(actor, eligibility, request, supplied[request.name]);
  }));
}

function participationOfferWorkspaceCharacter(character: Awaited<ReturnType<typeof characterProjections>>[number]): ParticipationOfferWorkspaceCharacter {
  return {
    characterRecordId: character.characterRecordId,
    region: character.region,
    realmId: character.realmId,
    characterId: character.characterId,
    name: character.name,
    realmName: character.realmName,
    className: character.className,
  };
}

async function participationOfferWorkspaceAcquisition(
  actor: ActivityParticipationActor,
  eligibility: ActivityParticipationEligibility,
  request: ActivityParticipationContextRequest,
): Promise<ParticipationOfferWorkspaceAcquisition> {
  if (request.kind === "integer") return { kind: "integer" };
  if (request.kind === "string") return { kind: "string" };

  if (request.kind === "guild_character") {
    return { kind: "guild_character", characters: await guildCharacterParticipationAcquisition(actor) };
  }

  const acquisition = await wowSpecParticipationAcquisition(actor, eligibility);
  return {
    kind: "wow_spec",
    characters: acquisition.characters,
    allowDeclaredClass: acquisition.allowDeclaredClass,
  };
}

export async function participationOfferWorkspace(input: {
  actor: ActivityParticipationActor;
  eligibility: ActivityParticipationEligibility;
  contract: ActivityParticipationOfferContract;
  existingOffer?: ActivityParticipationOffer | null;
}): Promise<ParticipationOfferWorkspace> {
  await validateParticipationOfferActor(input.actor, input.eligibility);

  if (input.existingOffer && (
    input.existingOffer.actor.kind !== input.actor.kind
    || input.existingOffer.actor.reference !== input.actor.reference
  )) {
    throw new ActivityParticipationOfferError(
      "offer_actor_mismatch",
      "Participation Offer workspace cannot hydrate an Offer belonging to another actor",
      403,
    );
  }

  const currentByName = new Map(
    (input.existingOffer?.context ?? []).map((item) => [item.name, item.value] as const),
  );
  const names = input.contract.context.map((request) => contextName(request.name));
  if (new Set(names).size !== names.length) {
    throw new Error("Activity Participation Offer context names must be unique");
  }

  const requests = await Promise.all(input.contract.context.map(async (request) => ({
    request,
    currentValue: currentByName.get(request.name) ?? null,
    acquisition: await participationOfferWorkspaceAcquisition(input.actor, input.eligibility, request),
  })));

  return {
    actor: input.actor,
    requests,
    complete: requests.every(({ request, currentValue }) =>
      currentValue !== null
      && (request.allowMultiple ? Array.isArray(currentValue) && currentValue.length > 0 : !Array.isArray(currentValue))
    ),
  };
}

export async function constructActivityParticipationOffer(
  client: PoolClient,
  input: {
    activityKind: string;
    activityId: string;
    actor: ActivityParticipationActor;
    eligibility: ActivityParticipationEligibility;
    contract: ActivityParticipationOfferContract;
    context: Readonly<Record<string, unknown>>;
    procedureReference: string;
    offeredAtUnix?: number;
  },
): Promise<ActivityParticipationOffer> {
  await validateParticipationOfferActor(input.actor, input.eligibility);
  const context = await constructParticipationContext(input.actor, input.eligibility, input.contract, input.context);

  return offerActivityParticipation(client, {
    activityKind: input.activityKind,
    activityId: input.activityId,
    actor: input.actor,
    context,
    procedureReference: input.procedureReference,
    offeredAtUnix: input.offeredAtUnix,
  });
}

export async function reviseActivityParticipationOffer(
  client: PoolClient,
  input: {
    activityKind: string;
    activityId: string;
    actor: ActivityParticipationActor;
    eligibility: ActivityParticipationEligibility;
    contract: ActivityParticipationOfferContract;
    context: Readonly<Record<string, unknown>>;
    procedureReference: string;
  },
): Promise<ActivityParticipationOffer> {
  const existing = await activityParticipationOfferByProcedureReference(client, {
    activityKind: input.activityKind,
    activityId: input.activityId,
    procedureReference: input.procedureReference,
  });
  if (!existing || existing.revokedAtUnix !== null || existing.closedAtUnix !== null) {
    throw new Error("Outstanding Activity Participation Offer was not found");
  }
  if (existing.actor.kind !== input.actor.kind || existing.actor.reference !== input.actor.reference) {
    throw new Error("Outstanding Activity Participation Offer was not found for actor");
  }
  await validateParticipationOfferActor(input.actor, input.eligibility);
  const names = input.contract.context.map((request) => contextName(request.name));
  if (new Set(names).size !== names.length) throw new Error("Activity Participation Offer context names must be unique");
  const unexpected = Object.keys(input.context).filter((name) => !names.includes(name));
  if (unexpected.length) throw new ActivityParticipationOfferError("unexpected_context", `Participation Offer does not accept context ${unexpected[0]}`);
  const existingByName = new Map(existing.context.map((item) => [item.name, item] as const));
  const context = await Promise.all(input.contract.context.map(async (request) => {
    if (!Object.prototype.hasOwnProperty.call(input.context, request.name)) {
      throw new ActivityParticipationOfferError("missing_context", `Participation Offer requires context ${request.name}`);
    }
    return constructParticipationRevisionContextItem(
      input.actor,
      input.eligibility,
      request,
      existingByName.get(request.name),
      input.context[request.name],
    );
  }));
  const result = await client.query<any>(
    `UPDATE activity_participation_offers offer
        SET context=$4::jsonb
      WHERE offer.participation_offer_id=$1
        AND offer.activity_kind=$2
        AND offer.activity_id=$3
        AND offer.revoked_at_unix IS NULL
        AND offer.closed_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_participations participation
           WHERE participation.participation_offer_id=offer.participation_offer_id
        )
      RETURNING *`,
    [existing.participationOfferId, input.activityKind, input.activityId, JSON.stringify(context)],
  );
  if (!result.rowCount) throw new Error("Outstanding Activity Participation Offer cannot be revised");
  return mapParticipationOffer(result.rows[0]);
}

export type ActivityParticipation = {
  participationId: string;
  activityKind: string;
  activityId: string;
  party: ActivityParticipationParty;
  procedureReference: string;
  participationOfferId: string | null;
  establishedAtUnix: number;
};

function mapParticipation(row: {
  participation_id: string;
  activity_kind: string;
  activity_id: string;
  party_kind: "native" | "external";
  party_reference: string;
  procedure_reference: string;
  participation_offer_id: string | null;
  established_at_unix: string | number;
}): ActivityParticipation {
  return {
    participationId: row.participation_id,
    activityKind: row.activity_kind,
    activityId: row.activity_id,
    party: { kind: row.party_kind, reference: row.party_reference },
    procedureReference: row.procedure_reference,
    participationOfferId: row.participation_offer_id,
    establishedAtUnix: Number(row.established_at_unix),
  };
}

export async function establishActivityParticipation(
  client: PoolClient,
  input: {
    activityKind: string;
    activityId: string;
    party: ActivityParticipationParty;
    procedureReference: string;
    participationOfferId?: string | null;
    establishedAtUnix?: number;
  },
): Promise<ActivityParticipation> {
  const activityKind = requiredText(input.activityKind, "kind");
  const activityId = requiredText(input.activityId, "activity id");
  const partyReference = requiredText(input.party.reference, "party reference");
  const procedureReference = requiredText(input.procedureReference, "procedure reference");
  const establishedAtUnix = input.establishedAtUnix ?? Math.floor(Date.now() / 1000);
  let participationOfferId = input.participationOfferId ?? null;

  if (participationOfferId !== null) {
    const offer = await client.query<{ revoked_at_unix: string | number | null; closed_at_unix: string | number | null }>(
      `SELECT revoked_at_unix, closed_at_unix
         FROM activity_participation_offers
        WHERE participation_offer_id=$1
          AND activity_kind=$2
          AND activity_id=$3
          AND party_kind=$4
          AND party_reference=$5`,
      [participationOfferId, activityKind, activityId, input.party.kind, partyReference],
    );
    if (!offer.rowCount) throw new Error("Activity Participation Offer was not found for party");
    if (offer.rows[0].revoked_at_unix !== null || offer.rows[0].closed_at_unix !== null) {
      throw new Error("Settled Activity Participation Offer cannot establish Participation");
    }
  }

  const result = await client.query<any>(
    `INSERT INTO activity_participations (
       activity_kind, activity_id, party_kind, party_reference, procedure_reference,
       participation_offer_id, established_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (activity_kind, activity_id, procedure_reference) DO UPDATE
       SET procedure_reference=EXCLUDED.procedure_reference
     RETURNING *`,
    [activityKind, activityId, input.party.kind, partyReference, procedureReference, participationOfferId, establishedAtUnix],
  );

  return mapParticipation(result.rows[0]);
}

export async function revokeActivityParticipationOffer(
  client: PoolClient,
  input: {
    activityKind: string;
    activityId: string;
    actor: ActivityParticipationActor;
    procedureReference: string;
    revokedAtUnix?: number;
  },
): Promise<void> {
  const revokedAtUnix = input.revokedAtUnix ?? Math.floor(Date.now() / 1000);
  const result = await client.query(
    `UPDATE activity_participation_offers offer
        SET revoked_at_unix=$6
      WHERE offer.activity_kind=$1
        AND offer.activity_id=$2
        AND offer.party_kind=$3
        AND offer.party_reference=$4
        AND offer.procedure_reference=$5
        AND offer.revoked_at_unix IS NULL
        AND offer.closed_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_participations participation
           WHERE participation.participation_offer_id=offer.participation_offer_id
        )`,
    [
      requiredText(input.activityKind, "Offer kind"),
      requiredText(input.activityId, "Offer activity id"),
      input.actor.kind,
      requiredText(input.actor.reference, "Offer actor reference"),
      requiredText(input.procedureReference, "Offer procedure reference"),
      revokedAtUnix,
    ],
  );
  if (!result.rowCount) throw new Error("Outstanding Activity Participation Offer was not found for actor");
}

export async function closeActivityParticipationOffer(
  client: PoolClient,
  input: {
    activityKind: string;
    activityId: string;
    procedureReference: string;
    closedAtUnix?: number;
  },
): Promise<void> {
  const closedAtUnix = input.closedAtUnix ?? Math.floor(Date.now() / 1000);
  const result = await client.query(
    `UPDATE activity_participation_offers offer
        SET closed_at_unix=$4
      WHERE offer.activity_kind=$1
        AND offer.activity_id=$2
        AND offer.procedure_reference=$3
        AND offer.revoked_at_unix IS NULL
        AND offer.closed_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_participations participation
           WHERE participation.participation_offer_id=offer.participation_offer_id
        )`,
    [
      requiredText(input.activityKind, "Offer kind"),
      requiredText(input.activityId, "Offer activity id"),
      requiredText(input.procedureReference, "Offer procedure reference"),
      closedAtUnix,
    ],
  );
  if (!result.rowCount) throw new Error("Outstanding Activity Participation Offer was not found");
}

export async function closeOutstandingActivityParticipationOffers(
  client: PoolClient,
  input: { activityKind: string; activityId: string; closedAtUnix?: number },
): Promise<number> {
  const closedAtUnix = input.closedAtUnix ?? Math.floor(Date.now() / 1000);
  const result = await client.query(
    `UPDATE activity_participation_offers offer
        SET closed_at_unix=$3
      WHERE offer.activity_kind=$1
        AND offer.activity_id=$2
        AND offer.revoked_at_unix IS NULL
        AND offer.closed_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_participations participation
           WHERE participation.participation_offer_id=offer.participation_offer_id
        )`,
    [requiredText(input.activityKind, "Offer kind"), requiredText(input.activityId, "Offer activity id"), closedAtUnix],
  );
  return result.rowCount ?? 0;
}
export async function outstandingActivityParticipationOffersForActor(
  client: PoolClient,
  input: { activityKind: string; activityId: string; actor: ActivityParticipationActor },
): Promise<ActivityParticipationOffer[]> {
  const result = await client.query<any>(
    `SELECT *
       FROM activity_participation_offers
      WHERE activity_kind=$1
        AND activity_id=$2
        AND party_kind=$3
        AND party_reference=$4
        AND revoked_at_unix IS NULL
        AND closed_at_unix IS NULL
      ORDER BY offered_at_unix ASC, participation_offer_id ASC
      FOR UPDATE`,
    [
      requiredText(input.activityKind, "Offer kind"),
      requiredText(input.activityId, "Offer activity id"),
      input.actor.kind,
      requiredText(input.actor.reference, "Offer actor reference"),
    ],
  );
  return result.rows.map(mapParticipationOffer);
}

export async function activityParticipationOfferById(
  client: PoolClient,
  input: { activityKind: string; activityId: string; participationOfferId: string },
): Promise<ActivityParticipationOffer | null> {
  const result = await client.query<any>(
    `SELECT *
       FROM activity_participation_offers
      WHERE activity_kind=$1 AND activity_id=$2 AND participation_offer_id=$3`,
    [
      requiredText(input.activityKind, "Offer kind"),
      requiredText(input.activityId, "Offer activity id"),
      requiredText(input.participationOfferId, "Participation Offer id"),
    ],
  );
  return result.rows[0] ? mapParticipationOffer(result.rows[0]) : null;
}

export async function activityParticipationOfferByProcedureReference(
  client: PoolClient,
  input: { activityKind: string; activityId: string; procedureReference: string },
): Promise<ActivityParticipationOffer | null> {
  const result = await client.query<any>(
    `SELECT *
       FROM activity_participation_offers
      WHERE activity_kind=$1 AND activity_id=$2 AND procedure_reference=$3`,
    [
      requiredText(input.activityKind, "Offer kind"),
      requiredText(input.activityId, "Offer activity id"),
      requiredText(input.procedureReference, "Offer procedure reference"),
    ],
  );
  return result.rows[0] ? mapParticipationOffer(result.rows[0]) : null;
}

export async function activityParticipationOffersForActivity(
  client: PoolClient,
  input: { activityKind: string; activityId: string; procedureReferences?: readonly string[] },
): Promise<ActivityParticipationOffer[]> {
  const activityKind = requiredText(input.activityKind, "Offer kind");
  const activityId = requiredText(input.activityId, "Offer activity id");
  const procedureReferences = input.procedureReferences?.map((reference) => requiredText(reference, "Offer procedure reference"));
  if (procedureReferences && procedureReferences.length === 0) return [];
  const result = await client.query<any>(
    `SELECT *
       FROM activity_participation_offers
      WHERE activity_kind=$1
        AND activity_id=$2
        ${procedureReferences ? "AND procedure_reference = ANY($3::text[])" : ""}
      ORDER BY offered_at_unix ASC, participation_offer_id ASC`,
    procedureReferences ? [activityKind, activityId, procedureReferences] : [activityKind, activityId],
  );
  return result.rows.map(mapParticipationOffer);
}

export async function activityParticipationOffersForIdentity(identityId: string): Promise<ActivityParticipationOffer[]> {
  const result = await pool.query<any>(
    `SELECT offer.*
       FROM activity_participation_offers offer
      WHERE offer.party_kind='native'
        AND offer.party_reference=$1
        AND offer.revoked_at_unix IS NULL
        AND offer.closed_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_participations participation
           WHERE participation.participation_offer_id=offer.participation_offer_id
        )
      ORDER BY offer.offered_at_unix DESC, offer.participation_offer_id DESC`,
    [requiredText(identityId, "Offer identity id")],
  );
  return result.rows.map(mapParticipationOffer);
}

export async function activityParticipationsForIdentity(identityId: string): Promise<ActivityParticipation[]> {
  const result = await pool.query<any>(
    `SELECT *
       FROM activity_participations
      WHERE party_kind='native' AND party_reference=$1
      ORDER BY established_at_unix DESC, participation_id DESC`,
    [requiredText(identityId, "identity id")],
  );
  return result.rows.map(mapParticipation);
}
