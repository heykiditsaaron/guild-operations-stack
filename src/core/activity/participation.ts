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
  if (!normalized) throw new Error(`Activity Participation Offer ${field} is required`);
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
  const activityKind = requiredText(input.activityKind, "kind");
  const activityId = requiredText(input.activityId, "activity id");
  const partyReference = requiredText(input.party.reference, "party reference");
  const procedureReference = requiredText(input.procedureReference, "procedure reference");
  const offeredAtUnix = input.offeredAtUnix ?? Math.floor(Date.now() / 1000);

  const inserted = await client.query<{
    participation_offer_id: string;
    activity_kind: string;
    activity_id: string;
    party_kind: "guildie" | "external";
    party_reference: string;
    procedure_reference: string;
    offered_at_unix: string | number;
    revoked_at_unix: string | number | null;
  }>(
    `INSERT INTO activity_participation_offers (
       activity_kind, activity_id, party_kind, party_reference, procedure_reference, offered_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING
     RETURNING *`,
    [activityKind, activityId, input.party.kind, partyReference, procedureReference, offeredAtUnix],
  );

  if (inserted.rowCount) return mapParticipationOffer(inserted.rows[0]);

  const existing = await client.query<{
    participation_offer_id: string;
    activity_kind: string;
    activity_id: string;
    party_kind: "guildie" | "external";
    party_reference: string;
    procedure_reference: string;
    offered_at_unix: string | number;
    revoked_at_unix: string | number | null;
  }>(
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
  return mapParticipationOffer(participation);
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
    `UPDATE activity_participation_offers
        SET revoked_at_unix=$6
      WHERE activity_kind=$1
        AND activity_id=$2
        AND party_kind=$3
        AND party_reference=$4
        AND procedure_reference=$5
        AND revoked_at_unix IS NULL`,
    [
      requiredText(input.activityKind, "kind"),
      requiredText(input.activityId, "activity id"),
      input.party.kind,
      requiredText(input.party.reference, "party reference"),
      requiredText(input.procedureReference, "procedure reference"),
      revokedAtUnix,
    ],
  );
  if (!result.rowCount) throw new Error("Active Activity Participation Offer Offer was not found for party");
}

export async function activityParticipationOffersForGuildie(guildieId: string): Promise<ActivityParticipationOffer[]> {
  const result = await pool.query<{
    participation_offer_id: string;
    activity_kind: string;
    activity_id: string;
    party_kind: "guildie";
    party_reference: string;
    procedure_reference: string;
    offered_at_unix: string | number;
    revoked_at_unix: string | number | null;
  }>(
    `SELECT *
       FROM activity_participation_offers
      WHERE party_kind='guildie' AND party_reference=$1
      ORDER BY offered_at_unix DESC, participation_offer_id DESC`,
    [requiredText(guildieId, "Guildie id")],
  );
  return result.rows.map(mapParticipationOffer);
}
