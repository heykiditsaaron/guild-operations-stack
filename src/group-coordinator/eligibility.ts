import { withTransaction } from "../db.js";
import type { ApplicantEligibility } from "./types.js";

export async function updateCoordinationApplicantEligibility(input: {
  coordinationId: string;
  actorGuildieId: string;
  applicantEligibility: ApplicantEligibility;
}): Promise<void> {
  await withTransaction(async (client) => {
    const organizer = await client.query(
      `SELECT 1
         FROM coordination_organizers
        WHERE coordination_id = $1
          AND guildie_id = $2`,
      [input.coordinationId, input.actorGuildieId],
    );
    if (!organizer.rowCount) throw new Error("Guildie is not an organizer for this Coordination");

    const updated = await client.query(
      `UPDATE coordinations
          SET applicant_eligibility = $1
        WHERE coordination_id = $2`,
      [input.applicantEligibility, input.coordinationId],
    );
    if (!updated.rowCount) throw new Error("Coordination not found");
  });
}
