import type { PoolClient } from "pg";
import { pool } from "../../db.js";

export type ActivityParticipationParty =
  | { kind: "guildie"; reference: string }
  | { kind: "external"; reference: string };

export type ActivityParticipation = {
  participationId: string;
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

function mapParticipation(row: {
  participation_id: string;
  activity_kind: string;
  activity_id: string;
  party_kind: "guildie" | "external";
  party_reference: string;
  procedure_reference: string;
  offered_at_unix: string | number;
  revoked_at_unix: string | number | null;
}): ActivityParticipation {
  return {
    participationId: row.participation_id,
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
): Promise<ActivityParticipation> {
  const activityKind = requiredText(input.activityKind, "kind");
  const activityId = requiredText(input.activityId, "activity id");
  const partyReference = requiredText(input.party.reference, "party reference");
  const procedureReference = requiredText(input.procedureReference, "procedure reference");
  const offeredAtUnix = input.offeredAtUnix ?? Math.floor(Date.now() / 1000);

  const inserted = await client.query<{
    participation_id: string;
    activity_kind: string;
    activity_id: string;
    party_kind: "guildie" | "external";
    party_reference: string;
    procedure_reference: string;
    offered_at_unix: string | number;
    revoked_at_unix: string | number | null;
  }>(
    `INSERT INTO activity_participations (
       activity_kind, activity_id, party_kind, party_reference, procedure_reference, offered_at_unix
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (activity_kind, activity_id, procedure_reference) DO NOTHING
     RETURNING *`,
    [activityKind, activityId, input.party.kind, partyReference, procedureReference, offeredAtUnix],
  );

  if (inserted.rowCount) return mapParticipation(inserted.rows[0]);

  const existing = await client.query<{
    participation_id: string;
    activity_kind: string;
    activity_id: string;
    party_kind: "guildie" | "external";
    party_reference: string;
    procedure_reference: string;
    offered_at_unix: string | number;
    revoked_at_unix: string | number | null;
  }>(
    `SELECT * FROM activity_participations
      WHERE activity_kind=$1 AND activity_id=$2 AND procedure_reference=$3`,
    [activityKind, activityId, procedureReference],
  );
  const participation = existing.rows[0];
  if (!participation) throw new Error("Activity Participation could not be reloaded");
  if (participation.party_kind !== input.party.kind || participation.party_reference !== partyReference) {
    throw new Error("Activity Participation procedure reference belongs to a different party");
  }
  if (participation.revoked_at_unix !== null) {
    throw new Error("Revoked Activity Participation cannot be offered again through the same procedure reference");
  }
  return mapParticipation(participation);
}

export async function revokeActivityParticipation(
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
    `UPDATE activity_participations
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
  if (!result.rowCount) throw new Error("Active Activity Participation was not found for party");
}

export async function activityParticipationsForGuildie(guildieId: string): Promise<ActivityParticipation[]> {
  const result = await pool.query<{
    participation_id: string;
    activity_kind: string;
    activity_id: string;
    party_kind: "guildie";
    party_reference: string;
    procedure_reference: string;
    offered_at_unix: string | number;
    revoked_at_unix: string | number | null;
  }>(
    `SELECT *
       FROM activity_participations
      WHERE party_kind='guildie' AND party_reference=$1
      ORDER BY offered_at_unix DESC, participation_id DESC`,
    [requiredText(guildieId, "Guildie id")],
  );
  return result.rows.map(mapParticipation);
}
