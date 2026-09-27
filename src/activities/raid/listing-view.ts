import { pool } from "../../db.js";

export type RaidListingParticipationSummary = {
  signedUp: number;
};

export async function raidListingParticipationSummary(
  raidId: string,
): Promise<RaidListingParticipationSummary> {
  const result = await pool.query<{ signed_up: string }>(
    `SELECT COUNT(DISTINCT rr.applicant_id)::text AS signed_up
       FROM raid_signup_rows rr
      WHERE rr.raid_id = $1
        AND rr.withdrawn_at_unix IS NULL`,
    [raidId],
  );

  return { signedUp: Number(result.rows[0]?.signed_up ?? 0) };
}
