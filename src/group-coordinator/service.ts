import type { PoolClient } from "pg";
import { pool, withTransaction } from "../db.js";
import { evaluateGoalCoverage } from "./evaluation.js";
import { getSpecDefinition } from "./registry.js";
import type {
  ApplicantEligibility,
  CoordinationApplicant,
  CoordinationAssignment,
  CoordinationGoal,
  CoordinationOffer,
  CoordinationOpportunity,
  CoordinationRole,
  GoalCoverage,
} from "./types.js";

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

async function requireOrganizer(client: PoolClient, coordinationId: string, guildieId: string): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM coordination_organizers WHERE coordination_id = $1 AND guildie_id = $2`,
    [coordinationId, guildieId],
  );
  if (!result.rowCount) throw new Error("Guildie is not an organizer for this Coordination");
}

async function coordinationContext(client: PoolClient, coordinationId: string): Promise<{ guildId: string; eligibility: ApplicantEligibility }> {
  const result = await client.query<{ guild_id: string; applicant_eligibility: ApplicantEligibility }>(
    `SELECT guild_id, applicant_eligibility FROM coordinations WHERE coordination_id = $1`,
    [coordinationId],
  );
  if (!result.rowCount) throw new Error("Coordination not found");
  return { guildId: result.rows[0].guild_id, eligibility: result.rows[0].applicant_eligibility };
}

async function hasCurrentGuildMembership(client: PoolClient, guildId: string, guildieId: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
      WHERE c.guildie_id = $1
        AND c.currently_controlled = true
        AND grm.guild_id = $2
        AND grm.currently_present = true
      LIMIT 1`,
    [guildieId, guildId],
  );
  return Boolean(result.rowCount);
}

async function isCurrentGuildCharacter(
  client: PoolClient,
  guildId: string,
  guildieId: string,
  characterRecordId: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
       FROM characters c
       JOIN guild_roster_memberships grm
         ON grm.region = c.region
        AND grm.realm_id = c.realm_id
        AND grm.character_id = c.character_id
      WHERE c.character_record_id = $1
        AND c.guildie_id = $2
        AND c.currently_controlled = true
        AND grm.guild_id = $3
        AND grm.currently_present = true`,
    [characterRecordId, guildieId, guildId],
  );
  return Boolean(result.rowCount);
}

type ControlledCharacterOfferFacts = {
  className: string | null;
  activeSpecName: string | null;
};

async function controlledCharacterOfferFacts(
  client: PoolClient,
  guildieId: string,
  characterRecordId: string,
): Promise<ControlledCharacterOfferFacts | null> {
  const result = await client.query<{
    class_name: string | null;
    active_spec_name: string | null;
  }>(
    `SELECT wcp.class_name, wcp.active_spec_name
       FROM characters c
       LEFT JOIN wow_character_profiles wcp
         ON wcp.region = c.region
        AND wcp.realm_id = c.realm_id
        AND wcp.character_id = c.character_id
      WHERE c.character_record_id = $1
        AND c.guildie_id = $2
        AND c.currently_controlled = true`,
    [characterRecordId, guildieId],
  );

  if (!result.rowCount) return null;
  return {
    className: result.rows[0].class_name,
    activeSpecName: result.rows[0].active_spec_name,
  };
}

export async function createCoordination(input: {
  guildId: string;
  applicantEligibility: ApplicantEligibility;
  organizerGuildieIds: readonly string[];
}): Promise<string> {
  const organizers = [...new Set(input.organizerGuildieIds)];
  if (!organizers.length) throw new Error("Coordination requires at least one organizer");

  return withTransaction(async (client) => {
    const created = await client.query<{ coordination_id: string }>(
      `INSERT INTO coordinations (guild_id, applicant_eligibility) VALUES ($1, $2) RETURNING coordination_id`,
      [input.guildId, input.applicantEligibility],
    );
    const coordinationId = created.rows[0].coordination_id;
    for (const guildieId of organizers) {
      await client.query(
        `INSERT INTO coordination_organizers (coordination_id, guildie_id) VALUES ($1, $2)`,
        [coordinationId, guildieId],
      );
    }
    return coordinationId;
  });
}

export async function addOpportunity(input: {
  coordinationId: string;
  actorGuildieId: string;
  key: string;
  label: string;
  requiredRole?: CoordinationRole | null;
  quantity?: number | null;
}): Promise<string> {
  if (!input.key.trim() || !input.label.trim()) throw new Error("Opportunity key and label are required");
  if (input.quantity !== undefined && input.quantity !== null && (!Number.isInteger(input.quantity) || input.quantity <= 0)) {
    throw new Error("Opportunity quantity must be a positive integer or null");
  }

  return withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);
    const result = await client.query<{ opportunity_id: string }>(
      `INSERT INTO coordination_opportunities (coordination_id, key, label, required_role, quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING opportunity_id`,
      [input.coordinationId, input.key.trim(), input.label.trim(), input.requiredRole ?? null, input.quantity ?? null],
    );
    return result.rows[0].opportunity_id;
  });
}

export async function addGoal(input: {
  coordinationId: string;
  actorGuildieId: string;
  tag: string;
  minimum: number;
}): Promise<string> {
  if (!input.tag.trim()) throw new Error("Goal tag is required");
  if (!Number.isInteger(input.minimum) || input.minimum <= 0) throw new Error("Goal minimum must be a positive integer");

  return withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);
    const result = await client.query<{ goal_id: string }>(
      `INSERT INTO coordination_goals (coordination_id, tag, minimum) VALUES ($1, $2, $3) RETURNING goal_id`,
      [input.coordinationId, input.tag.trim(), input.minimum],
    );
    return result.rows[0].goal_id;
  });
}

export async function registerApplicant(input:
  | { coordinationId: string; source: "guild_character"; guildieId: string; characterRecordId: string }
  | { coordinationId: string; source: "guildie"; guildieId: string }
  | { coordinationId: string; source: "external"; label: string }
): Promise<string> {
  return withTransaction(async (client) => {
    const context = await coordinationContext(client, input.coordinationId);

    if (context.eligibility === "guild_character") {
      if (input.source !== "guild_character") throw new Error("This Coordination only admits guild-character applicants");
      if (!(await isCurrentGuildCharacter(client, context.guildId, input.guildieId, input.characterRecordId))) {
        throw new Error("Applicant Character is not a currently controlled guild-roster Character");
      }
    } else if (context.eligibility === "guildie") {
      if (input.source !== "guildie") throw new Error("This Coordination only admits Guildie applicants");
      if (!(await hasCurrentGuildMembership(client, context.guildId, input.guildieId))) {
        throw new Error("Applicant is not a current Guildie");
      }
    } else if (input.source === "external" && !input.label.trim()) {
      throw new Error("External applicant label is required");
    }

    const result = input.source === "guild_character"
      ? await client.query<{ applicant_id: string }>(
          `INSERT INTO coordination_applicants (coordination_id, source, guildie_id, character_record_id)
           VALUES ($1, 'guild_character', $2, $3) RETURNING applicant_id`,
          [input.coordinationId, input.guildieId, input.characterRecordId],
        )
      : input.source === "guildie"
        ? await client.query<{ applicant_id: string }>(
            `INSERT INTO coordination_applicants (coordination_id, source, guildie_id)
             VALUES ($1, 'guildie', $2) RETURNING applicant_id`,
            [input.coordinationId, input.guildieId],
          )
        : await client.query<{ applicant_id: string }>(
            `INSERT INTO coordination_applicants (coordination_id, source, external_label)
             VALUES ($1, 'external', $2) RETURNING applicant_id`,
            [input.coordinationId, input.label.trim()],
          );

    return result.rows[0].applicant_id;
  });
}

export async function submitOffer(input: {
  coordinationId: string;
  applicantId: string;
  characterRecordId?: string | null;
  className?: string | null;
  specName?: string | null;
  payload?: Record<string, unknown>;
}): Promise<string> {
  return withTransaction(async (client) => {
    const applicant = await client.query<{ coordination_id: string; guildie_id: string | null }>(
      `SELECT coordination_id, guildie_id FROM coordination_applicants WHERE applicant_id = $1`,
      [input.applicantId],
    );
    if (!applicant.rowCount || applicant.rows[0].coordination_id !== input.coordinationId) {
      throw new Error("Applicant does not belong to this Coordination");
    }

    let className = input.className ?? null;
    let specName = input.specName ?? null;

    if (input.characterRecordId) {
      const guildieId = applicant.rows[0].guildie_id;
      if (!guildieId) throw new Error("Character-backed offers require a known Guildie applicant");

      const character = await controlledCharacterOfferFacts(client, guildieId, input.characterRecordId);
      if (!character) throw new Error("Offered Character is not currently controlled by the applicant");

      if (character.className) {
        if (className && className !== character.className) {
          throw new Error("Declared class does not match the offered Character");
        }
        className = character.className;
        specName = specName ?? character.activeSpecName;
      }

      if (!className || !specName) {
        throw new Error("Character class and specialization must be declared when they are not available from Blizzard Character profile state");
      }
    } else if (!className || !specName) {
      throw new Error("Declared offers require class and specialization");
    }

    if (!getSpecDefinition(className, specName)) {
      throw new Error("Unknown class/specialization combination");
    }

    const result = await client.query<{ offer_id: string }>(
      `INSERT INTO coordination_offers (
         coordination_id, applicant_id, character_record_id, class_name, spec_name, payload
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING offer_id`,
      [
        input.coordinationId,
        input.applicantId,
        input.characterRecordId ?? null,
        className,
        specName,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return result.rows[0].offer_id;
  });
}

export async function withdrawOffer(input: {
  coordinationId: string;
  applicantId: string;
  offerId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const activeAssignment = await client.query(
      `SELECT 1 FROM coordination_assignments WHERE offer_id = $1 AND released_at_unix IS NULL`,
      [input.offerId],
    );
    if (activeAssignment.rowCount) throw new Error("Assigned offers must be released before withdrawal");

    const result = await client.query(
      `UPDATE coordination_offers
          SET withdrawn_at_unix = $1
        WHERE offer_id = $2 AND coordination_id = $3 AND applicant_id = $4 AND withdrawn_at_unix IS NULL`,
      [nowUnix(), input.offerId, input.coordinationId, input.applicantId],
    );
    if (!result.rowCount) throw new Error("Active offer not found for applicant");
  });
}

export async function assignOffer(input: {
  coordinationId: string;
  actorGuildieId: string;
  offerId: string;
  opportunityId: string;
}): Promise<string> {
  return withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);

    const opportunity = await client.query<{
      coordination_id: string;
      required_role: CoordinationRole | null;
      quantity: number | null;
    }>(
      `SELECT coordination_id, required_role, quantity
         FROM coordination_opportunities
        WHERE opportunity_id = $1
        FOR UPDATE`,
      [input.opportunityId],
    );
    if (!opportunity.rowCount || opportunity.rows[0].coordination_id !== input.coordinationId) {
      throw new Error("Opportunity does not belong to this Coordination");
    }

    const offer = await client.query<{
      coordination_id: string;
      class_name: string | null;
      spec_name: string | null;
      withdrawn_at_unix: string | null;
    }>(
      `SELECT coordination_id, class_name, spec_name, withdrawn_at_unix FROM coordination_offers WHERE offer_id = $1`,
      [input.offerId],
    );
    if (!offer.rowCount || offer.rows[0].coordination_id !== input.coordinationId) {
      throw new Error("Offer does not belong to this Coordination");
    }
    if (offer.rows[0].withdrawn_at_unix !== null) throw new Error("Withdrawn offer cannot be assigned");

    const requiredRole = opportunity.rows[0].required_role;
    if (requiredRole) {
      const { class_name: offerClassName, spec_name: offerSpecName } = offer.rows[0];
      const definition = offerClassName && offerSpecName ? getSpecDefinition(offerClassName, offerSpecName) : null;
      if (!definition || definition.role !== requiredRole) {
        throw new Error(`Offer does not satisfy required role: ${requiredRole}`);
      }
    }

    const quantity = opportunity.rows[0].quantity;
    if (quantity !== null) {
      const assigned = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM coordination_assignments
          WHERE opportunity_id = $1 AND released_at_unix IS NULL`,
        [input.opportunityId],
      );
      if (Number(assigned.rows[0].count) >= quantity) throw new Error("Opportunity is already at capacity");
    }

    const created = await client.query<{ assignment_id: string }>(
      `INSERT INTO coordination_assignments (
         coordination_id, offer_id, opportunity_id, assigned_by_guildie_id
       ) VALUES ($1, $2, $3, $4)
       RETURNING assignment_id`,
      [input.coordinationId, input.offerId, input.opportunityId, input.actorGuildieId],
    );
    return created.rows[0].assignment_id;
  });
}

export async function releaseAssignment(input: {
  coordinationId: string;
  actorGuildieId: string;
  assignmentId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);
    const result = await client.query(
      `UPDATE coordination_assignments
          SET released_at_unix = $1, released_by_guildie_id = $2
        WHERE assignment_id = $3 AND coordination_id = $4 AND released_at_unix IS NULL`,
      [nowUnix(), input.actorGuildieId, input.assignmentId, input.coordinationId],
    );
    if (!result.rowCount) throw new Error("Active assignment not found");
  });
}

export async function goalCoverage(coordinationId: string): Promise<GoalCoverage[]> {
  const [goalsResult, offersResult] = await Promise.all([
    pool.query<{ goal_id: string; coordination_id: string; tag: string; minimum: number }>(
      `SELECT goal_id, coordination_id, tag, minimum FROM coordination_goals WHERE coordination_id = $1 ORDER BY created_at_unix, goal_id`,
      [coordinationId],
    ),
    pool.query<{
      offer_id: string;
      coordination_id: string;
      applicant_id: string;
      character_record_id: string | null;
      class_name: string | null;
      spec_name: string | null;
      payload: Record<string, unknown>;
      withdrawn_at_unix: string | null;
    }>(
      `SELECT o.offer_id, o.coordination_id, o.applicant_id, o.character_record_id,
              o.class_name, o.spec_name, o.payload, o.withdrawn_at_unix
         FROM coordination_assignments a
         JOIN coordination_offers o ON o.offer_id = a.offer_id
        WHERE a.coordination_id = $1 AND a.released_at_unix IS NULL`,
      [coordinationId],
    ),
  ]);

  const goals: CoordinationGoal[] = goalsResult.rows.map((row) => ({
    goalId: row.goal_id,
    coordinationId: row.coordination_id,
    tag: row.tag,
    minimum: row.minimum,
  }));
  const offers: CoordinationOffer[] = offersResult.rows.map((row) => ({
    offerId: row.offer_id,
    coordinationId: row.coordination_id,
    applicantId: row.applicant_id,
    characterRecordId: row.character_record_id,
    className: row.class_name,
    specName: row.spec_name,
    payload: row.payload,
    withdrawnAtUnix: row.withdrawn_at_unix === null ? null : Number(row.withdrawn_at_unix),
  }));

  return evaluateGoalCoverage(goals, offers);
}

export async function listApplicants(coordinationId: string): Promise<CoordinationApplicant[]> {
  const result = await pool.query<{
    applicant_id: string;
    coordination_id: string;
    source: CoordinationApplicant["source"];
    guildie_id: string | null;
    character_record_id: string | null;
    external_label: string | null;
  }>(
    `SELECT applicant_id, coordination_id, source, guildie_id, character_record_id, external_label
       FROM coordination_applicants WHERE coordination_id = $1 ORDER BY created_at_unix, applicant_id`,
    [coordinationId],
  );
  return result.rows.map((row) => ({
    applicantId: row.applicant_id,
    coordinationId: row.coordination_id,
    source: row.source,
    guildieId: row.guildie_id,
    characterRecordId: row.character_record_id,
    externalLabel: row.external_label,
  }));
}

export async function listOpportunities(coordinationId: string): Promise<CoordinationOpportunity[]> {
  const result = await pool.query<{
    opportunity_id: string;
    coordination_id: string;
    key: string;
    label: string;
    required_role: CoordinationRole | null;
    quantity: number | null;
  }>(
    `SELECT opportunity_id, coordination_id, key, label, required_role, quantity
       FROM coordination_opportunities WHERE coordination_id = $1 ORDER BY created_at_unix, opportunity_id`,
    [coordinationId],
  );
  return result.rows.map((row) => ({
    opportunityId: row.opportunity_id,
    coordinationId: row.coordination_id,
    key: row.key,
    label: row.label,
    requiredRole: row.required_role,
    quantity: row.quantity,
  }));
}

export async function listAssignments(coordinationId: string): Promise<CoordinationAssignment[]> {
  const result = await pool.query<{
    assignment_id: string;
    coordination_id: string;
    offer_id: string;
    opportunity_id: string;
    assigned_by_guildie_id: string;
    assigned_at_unix: string;
    released_at_unix: string | null;
  }>(
    `SELECT assignment_id, coordination_id, offer_id, opportunity_id,
            assigned_by_guildie_id, assigned_at_unix, released_at_unix
       FROM coordination_assignments WHERE coordination_id = $1 ORDER BY assigned_at_unix, assignment_id`,
    [coordinationId],
  );
  return result.rows.map((row) => ({
    assignmentId: row.assignment_id,
    coordinationId: row.coordination_id,
    offerId: row.offer_id,
    opportunityId: row.opportunity_id,
    assignedByGuildieId: row.assigned_by_guildie_id,
    assignedAtUnix: Number(row.assigned_at_unix),
    releasedAtUnix: row.released_at_unix === null ? null : Number(row.released_at_unix),
  }));
}
