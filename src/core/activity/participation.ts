import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import { controlledGuildCharactersForGuildie } from "../identity/controlled-characters.js";
import type { ActivitySharedValue } from "./registry.js";

export type ActivityParticipationActor =
  | { kind: "guildie"; reference: string }
  | { kind: "external"; reference: string };

/** @deprecated Use ActivityParticipationActor. */
export type ActivityParticipationParty = ActivityParticipationActor;

export type ActivityParticipationComponent = {
  kind: string;
  value: ActivitySharedValue;
};

export type ActivityParticipationOffer = {
  participationOfferId: string;
  activityKind: string;
  activityId: string;
  actor: ActivityParticipationActor;
  components: readonly ActivityParticipationComponent[];
  procedureReference: string;
  offeredAtUnix: number;
  revokedAtUnix: number | null;
  closedAtUnix: number | null;
};

export type OfferActivityParticipationInput = {
  activityKind: string;
  activityId: string;
  party: ActivityParticipationParty;
  components?: readonly ActivityParticipationComponent[];
  procedureReference: string;
  offeredAtUnix?: number;
};

export type ActivityParticipationComponentRequest =
  | {
      kind: string;
      type: "integer";
      greaterThan?: number;
      greaterThanOrEqual?: number;
      lessThan?: number;
      lessThanOrEqual?: number;
    }
  | { kind: string; type: "guild_character" };

export type ActivityParticipationOfferContract = {
  components: readonly ActivityParticipationComponentRequest[];
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
  party_kind: "guildie" | "external";
  party_reference: string;
  components: unknown;
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
    components: Array.isArray(row.components) ? row.components as ActivityParticipationComponent[] : [],
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
  const partyReference = requiredText(input.party.reference, "Offer party reference");
  const procedureReference = requiredText(input.procedureReference, "Offer procedure reference");
  const offeredAtUnix = input.offeredAtUnix ?? Math.floor(Date.now() / 1000);
  const components = input.components ?? [];

  const inserted = await client.query<any>(
    `INSERT INTO activity_participation_offers (
       activity_kind, activity_id, party_kind, party_reference, components, procedure_reference, offered_at_unix
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
     ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING
     RETURNING *`,
    [activityKind, activityId, input.party.kind, partyReference, JSON.stringify(components), procedureReference, offeredAtUnix],
  );

  if (inserted.rowCount) return mapParticipationOffer(inserted.rows[0]);

  const existing = await client.query<any>(
    `SELECT * FROM activity_participation_offers
      WHERE activity_kind=$1 AND activity_id=$2 AND procedure_reference=$3`,
    [activityKind, activityId, procedureReference],
  );
  const offer = existing.rows[0];
  if (!offer) throw new Error("Activity Participation Offer could not be reloaded");
  if (offer.party_kind !== input.party.kind || offer.party_reference !== partyReference) {
    throw new Error("Activity Participation Offer procedure reference belongs to a different party");
  }
  if (JSON.stringify(offer.components ?? []) !== JSON.stringify(components)) {
    throw new Error("Activity Participation Offer procedure reference belongs to different components");
  }
  if (offer.revoked_at_unix !== null || offer.closed_at_unix !== null) {
    throw new Error("Settled Activity Participation Offer cannot be offered again through the same procedure reference");
  }
  return mapParticipationOffer(offer);
}


function componentKind(value: string): string {
  return requiredText(value, "Offer component kind");
}

function requireIntegerComponent(
  request: Extract<ActivityParticipationComponentRequest, { type: "integer" }>,
  raw: unknown,
): ActivityParticipationComponent {
  if (!Number.isSafeInteger(raw)) {
    throw new ActivityParticipationOfferError("invalid_integer", `${request.kind} must be an integer`);
  }
  const value = raw as number;
  if (request.greaterThan !== undefined && !(value > request.greaterThan)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.kind} must be greater than ${request.greaterThan}`);
  }
  if (request.greaterThanOrEqual !== undefined && !(value >= request.greaterThanOrEqual)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.kind} must be at least ${request.greaterThanOrEqual}`);
  }
  if (request.lessThan !== undefined && !(value < request.lessThan)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.kind} must be less than ${request.lessThan}`);
  }
  if (request.lessThanOrEqual !== undefined && !(value <= request.lessThanOrEqual)) {
    throw new ActivityParticipationOfferError("integer_out_of_range", `${request.kind} must be at most ${request.lessThanOrEqual}`);
  }
  return { kind: componentKind(request.kind), value: { type: "integer", value } };
}

async function constructParticipationComponent(
  party: ActivityParticipationParty,
  request: ActivityParticipationComponentRequest,
  raw: unknown,
): Promise<ActivityParticipationComponent> {
  if (request.type === "integer") return requireIntegerComponent(request, raw);

  if (party.kind !== "guildie") {
    throw new ActivityParticipationOfferError("guild_character_requires_guildie", "A guild Character must be offered by a Guildie");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new ActivityParticipationOfferError("invalid_guild_character", `${request.kind} must identify a guild Character`);
  }
  const candidate = raw as { realmId?: unknown; characterId?: unknown };
  if (typeof candidate.realmId !== "string" || typeof candidate.characterId !== "string") {
    throw new ActivityParticipationOfferError("invalid_guild_character", `${request.kind} must identify a guild Character`);
  }

  const character = (await controlledGuildCharactersForGuildie(party.reference))
    .find((item) => item.realmId === candidate.realmId && item.characterId === candidate.characterId);
  if (!character) {
    throw new ActivityParticipationOfferError(
      "guild_character_unavailable",
      `${request.kind} must be a currently controlled Character on the current guild roster`,
      403,
    );
  }

  return {
    kind: componentKind(request.kind),
    value: {
      type: "guild_character",
      value: {
        characterRecordId: character.characterRecordId,
        region: character.region,
        realmId: character.realmId,
        characterId: character.characterId,
        name: character.name,
      },
    },
  };
}

export async function constructActivityParticipationOffer(
  client: PoolClient,
  input: {
    activityKind: string;
    activityId: string;
    party: ActivityParticipationParty;
    contract: ActivityParticipationOfferContract;
    components: Readonly<Record<string, unknown>>;
    procedureReference: string;
    offeredAtUnix?: number;
  },
): Promise<ActivityParticipationOffer> {
  const requests = input.contract.components;
  const kinds = requests.map((request) => componentKind(request.kind));
  if (new Set(kinds).size !== kinds.length) {
    throw new Error("Activity Participation Offer contract component kinds must be unique");
  }
  const suppliedKinds = Object.keys(input.components);
  const unexpected = suppliedKinds.filter((kind) => !kinds.includes(kind));
  if (unexpected.length) {
    throw new ActivityParticipationOfferError("unexpected_component", `Participation Offer does not accept component ${unexpected[0]}`);
  }

  const components = await Promise.all(requests.map(async (request) => {
    if (!Object.prototype.hasOwnProperty.call(input.components, request.kind)) {
      throw new ActivityParticipationOfferError("missing_component", `Participation Offer requires component ${request.kind}`);
    }
    return constructParticipationComponent(input.party, request, input.components[request.kind]);
  }));

  return offerActivityParticipation(client, {
    activityKind: input.activityKind,
    activityId: input.activityId,
    party: input.party,
    components,
    procedureReference: input.procedureReference,
    offeredAtUnix: input.offeredAtUnix,
  });
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
  party_kind: "guildie" | "external";
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
    party: ActivityParticipationParty;
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
      input.party.kind,
      requiredText(input.party.reference, "Offer party reference"),
      requiredText(input.procedureReference, "Offer procedure reference"),
      revokedAtUnix,
    ],
  );
  if (!result.rowCount) throw new Error("Outstanding Activity Participation Offer was not found for party");
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
export async function activityParticipationOffersForGuildie(guildieId: string): Promise<ActivityParticipationOffer[]> {
  const result = await pool.query<any>(
    `SELECT offer.*
       FROM activity_participation_offers offer
      WHERE offer.party_kind='guildie'
        AND offer.party_reference=$1
        AND offer.revoked_at_unix IS NULL
        AND offer.closed_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_participations participation
           WHERE participation.participation_offer_id=offer.participation_offer_id
        )
      ORDER BY offer.offered_at_unix DESC, offer.participation_offer_id DESC`,
    [requiredText(guildieId, "Offer Guildie id")],
  );
  return result.rows.map(mapParticipationOffer);
}

export async function activityParticipationsForGuildie(guildieId: string): Promise<ActivityParticipation[]> {
  const result = await pool.query<any>(
    `SELECT *
       FROM activity_participations
      WHERE party_kind='guildie' AND party_reference=$1
      ORDER BY established_at_unix DESC, participation_id DESC`,
    [requiredText(guildieId, "Guildie id")],
  );
  return result.rows.map(mapParticipation);
}
