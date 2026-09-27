import type { PoolClient } from "pg";
import { pool } from "../../db.js";

export type ActivityParticipationParty =
  | { kind: "guildie"; reference: string }
  | { kind: "external"; reference: string };

export type ActivityParticipationOffer = {
  participationOfferId: string;
  activityKind: string;
  activityId: string;
  party: ActivityParticipationParty;
  procedureReference: string;
  offeredAtUnix: number;
  revokedAtUnix: number | null;
};

export type OfferActivityParticipationInput = {
  activityKind: string;
  activityId: string;
  party: ActivityParticipationParty;
  procedureReference: string;
  offeredAtUnix?: number;
};

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
  procedure_reference: string;
  offered_at_unix: string | number;
  revoked_at_unix: string | number | null;
}): ActivityParticipationOffer {
  return {
    participationOfferId: row.participation_offer_id,
    activityKind: row.activity_kind,
    activityId: row.activity_id,
    party: { kind: row.party_kind, reference: row.party_reference },
    procedureReference: row.procedure_reference,
    offeredAtUnix: Number(row.offered_at_unix),
    revokedAtUnix: row.revoked_at_unix === null ? null : Number(row.revoked_at_unix),
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

  const inserted = await client.query<any>(
    `INSERT INTO activity_participation_offers (
       activity_kind, activity_id, party_kind, party_reference, procedure_reference, offered_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING
     RETURNING *`,
    [activityKind, activityId, input.party.kind, partyReference, procedureReference, offeredAtUnix],
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
  if (offer.revoked_at_unix !== null) {
    throw new Error("Revoked Activity Participation Offer cannot be offered again through the same procedure reference");
  }
  return mapParticipationOffer(offer);
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
    const offer = await client.query<{ revoked_at_unix: string | number | null }>(
      `SELECT revoked_at_unix
         FROM activity_participation_offers
        WHERE participation_offer_id=$1
          AND activity_kind=$2
          AND activity_id=$3
          AND party_kind=$4
          AND party_reference=$5`,
      [participationOfferId, activityKind, activityId, input.party.kind, partyReference],
    );
    if (!offer.rowCount) throw new Error("Activity Participation Offer was not found for party");
    if (offer.rows[0].revoked_at_unix !== null) {
      throw new Error("Revoked Activity Participation Offer cannot establish Participation");
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

export async function activityParticipationOffersForGuildie(guildieId: string): Promise<ActivityParticipationOffer[]> {
  const result = await pool.query<any>(
    `SELECT offer.*
       FROM activity_participation_offers offer
      WHERE offer.party_kind='guildie'
        AND offer.party_reference=$1
        AND offer.revoked_at_unix IS NULL
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
