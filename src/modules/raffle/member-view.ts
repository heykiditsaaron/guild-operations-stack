import { config } from "../../config.js";
import { discordAssociationForSubject } from "../../discord.js";
import { pool } from "../../db.js";
import { mainCharacterForSubject } from "../../main-character.js";
import type { RaffleClaimResolution } from "./domain.js";

export type RaffleMemberClaim = {
  claimId: string;
  roundId: string;
  characterId: string;
  realmId: string;
  characterName: string;
  requestedTicketCount: number;
  promisedGoldValue: string;
  createdAt: Date;
  resolutionKind: RaffleClaimResolution;
  resolutionActorLabel: string | null;
  denialReason: string | null;
};

async function subjectAttribution(subjectId: string): Promise<string> {
  const [mainCharacter, discordAssociation] = await Promise.all([
    mainCharacterForSubject(subjectId),
    discordAssociationForSubject(subjectId),
  ]);

  return mainCharacter?.name ?? discordAssociation?.username ?? "Guild officer";
}

export async function raffleClaimsForMember(subjectId: string, roundId: string): Promise<RaffleMemberClaim[]> {
  const result = await pool.query(
    `SELECT
       rc.claim_id,
       rc.round_id,
       rc.requested_ticket_count,
       rc.promised_gold_value,
       rc.created_at,
       rc.resolution_kind,
       rc.approved_by_subject_id,
       rc.denied_by_subject_id,
       rc.denial_reason,
       c.character_id,
       c.realm_id,
       COALESCE(grm.character_name, c.name) AS character_name
     FROM raffle_claims rc
     JOIN raffle_rounds rr
       ON rr.round_id = rc.round_id
      AND rr.guild_id = $3
     JOIN characters c ON c.character_record_id = rc.character_record_id
     LEFT JOIN guild_roster_memberships grm
       ON grm.guild_id = rr.guild_id
      AND grm.region = c.region
      AND grm.realm_id = c.realm_id
      AND grm.character_id = c.character_id
    WHERE rc.round_id = $1
      AND rc.subject_id = $2
    ORDER BY rc.created_at DESC, rc.claim_id DESC`,
    [roundId, subjectId, config.guild.id],
  );

  const actorSubjectIds = new Set<string>();
  for (const row of result.rows) {
    const actorSubjectId = row.resolution_kind === "approved"
      ? row.approved_by_subject_id
      : row.resolution_kind === "denied"
        ? row.denied_by_subject_id
        : null;
    if (actorSubjectId !== null) actorSubjectIds.add(String(actorSubjectId));
  }

  const attributionEntries = await Promise.all(
    [...actorSubjectIds].map(async (actorSubjectId) => [
      actorSubjectId,
      await subjectAttribution(actorSubjectId),
    ] as const),
  );
  const attributionBySubjectId = new Map(attributionEntries);

  return result.rows.map((row) => {
    const resolutionActorSubjectId = row.resolution_kind === "approved"
      ? row.approved_by_subject_id
      : row.resolution_kind === "denied"
        ? row.denied_by_subject_id
        : null;

    return {
      claimId: String(row.claim_id),
      roundId: String(row.round_id),
      characterId: String(row.character_id),
      realmId: String(row.realm_id),
      characterName: String(row.character_name),
      requestedTicketCount: Number(row.requested_ticket_count),
      promisedGoldValue: String(row.promised_gold_value),
      createdAt: row.created_at as Date,
      resolutionKind: row.resolution_kind as RaffleClaimResolution,
      resolutionActorLabel: resolutionActorSubjectId === null
        ? null
        : attributionBySubjectId.get(String(resolutionActorSubjectId)) ?? "Guild officer",
      denialReason: row.denial_reason === null ? null : String(row.denial_reason),
    };
  });
}
