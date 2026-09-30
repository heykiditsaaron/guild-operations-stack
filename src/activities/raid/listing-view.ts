import { pool } from "../../db.js";

export type RaidListingParticipationSummary = {
  signedUp: number;
};

export async function raidListingParticipationSummary(
  raidId: string,
): Promise<RaidListingParticipationSummary> {
  const result = await pool.query<{ signed_up: string }>(
    `SELECT COUNT(*)::text AS signed_up
       FROM raid_signup_rows rr
      WHERE rr.raid_id = $1
        AND rr.withdrawn_at_unix IS NULL
        AND NOT EXISTS (
          SELECT 1
            FROM raid_signup_denials rsd
           WHERE rsd.raid_id = rr.raid_id
             AND rsd.signup_row_id = rr.signup_row_id
        )`,
    [raidId],
  );

  return { signedUp: Number(result.rows[0]?.signed_up ?? 0) };
}
