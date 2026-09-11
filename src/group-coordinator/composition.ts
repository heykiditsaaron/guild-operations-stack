import { withTransaction } from "../db.js";
import type { CoordinationGoal, CoordinationOpportunity, CoordinationRole } from "./types.js";

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function roleLabel(role: CoordinationRole): string {
  if (role === "tank") return "Tank";
  if (role === "healer") return "Healer";
  return "Damage";
}

async function requireOrganizer(
  client: import("pg").PoolClient,
  coordinationId: string,
  guildieId: string,
): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM coordination_organizers
      WHERE coordination_id = $1
        AND guildie_id = $2`,
    [coordinationId, guildieId],
  );
  if (!result.rowCount) throw new Error("Guildie is not an organizer for this Coordination");
}

export async function addCoordinationRoleSlot(input: {
  coordinationId: string;
  actorGuildieId: string;
  role: CoordinationRole;
}): Promise<string> {
  return withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);

    const existing = await client.query<{ opportunity_id: string; quantity: number | null }>(
      `SELECT opportunity_id, quantity
         FROM coordination_opportunities
        WHERE coordination_id = $1
          AND required_role = $2
          AND removed_at_unix IS NULL
        ORDER BY created_at_unix, opportunity_id
        LIMIT 1
        FOR UPDATE`,
      [input.coordinationId, input.role],
    );

    if (existing.rowCount) {
      const opportunityId = existing.rows[0].opportunity_id;
      const quantity = existing.rows[0].quantity;
      if (quantity === null) return opportunityId;
      await client.query(
        `UPDATE coordination_opportunities
            SET quantity = quantity + 1
          WHERE opportunity_id = $1`,
        [opportunityId],
      );
      return opportunityId;
    }

    const key = `role:${input.role}`;
    const label = roleLabel(input.role);
    const result = await client.query<{ opportunity_id: string }>(
      `INSERT INTO coordination_opportunities (
         coordination_id, key, label, required_role, quantity
       ) VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (coordination_id, key)
       DO UPDATE SET
         quantity = 1,
         label = EXCLUDED.label,
         required_role = EXCLUDED.required_role,
         removed_at_unix = NULL
       RETURNING opportunity_id`,
      [input.coordinationId, key, label, input.role],
    );
    return result.rows[0].opportunity_id;
  });
}

export async function removeCoordinationRoleSlot(input: {
  coordinationId: string;
  actorGuildieId: string;
  opportunityId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);

    const opportunity = await client.query<{
      quantity: number | null;
      removed_at_unix: string | null;
    }>(
      `SELECT quantity, removed_at_unix
         FROM coordination_opportunities
        WHERE opportunity_id = $1
          AND coordination_id = $2
        FOR UPDATE`,
      [input.opportunityId, input.coordinationId],
    );
    if (!opportunity.rowCount || opportunity.rows[0].removed_at_unix !== null) {
      throw new Error("Active slot group not found");
    }

    const quantity = opportunity.rows[0].quantity;
    if (quantity === null) throw new Error("Unbounded slot groups cannot remove one slot");

    const assigned = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM coordination_assignments
        WHERE opportunity_id = $1
          AND released_at_unix IS NULL`,
      [input.opportunityId],
    );
    const activeAssignments = Number(assigned.rows[0].count);
    if (activeAssignments >= quantity) {
      throw new Error("Release an assignment before removing this slot");
    }

    if (quantity > 1) {
      await client.query(
        `UPDATE coordination_opportunities
            SET quantity = quantity - 1
          WHERE opportunity_id = $1`,
        [input.opportunityId],
      );
      return;
    }

    await client.query(
      `UPDATE coordination_opportunities
          SET removed_at_unix = $1
        WHERE opportunity_id = $2`,
      [nowUnix(), input.opportunityId],
    );
  });
}

export async function updateCoordinationGoalMinimum(input: {
  coordinationId: string;
  actorGuildieId: string;
  goalId: string;
  minimum: number;
}): Promise<void> {
  if (!Number.isInteger(input.minimum) || input.minimum <= 0) {
    throw new Error("Goal minimum must be a positive integer");
  }

  await withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);
    const result = await client.query(
      `UPDATE coordination_goals
          SET minimum = $1
        WHERE goal_id = $2
          AND coordination_id = $3`,
      [input.minimum, input.goalId, input.coordinationId],
    );
    if (!result.rowCount) throw new Error("Goal not found");
  });
}

export async function removeCoordinationGoal(input: {
  coordinationId: string;
  actorGuildieId: string;
  goalId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    await requireOrganizer(client, input.coordinationId, input.actorGuildieId);
    const result = await client.query(
      `DELETE FROM coordination_goals
        WHERE goal_id = $1
          AND coordination_id = $2`,
      [input.goalId, input.coordinationId],
    );
    if (!result.rowCount) throw new Error("Goal not found");
  });
}

export async function listActiveCoordinationOpportunities(
  coordinationId: string,
): Promise<CoordinationOpportunity[]> {
  const result = await withTransaction(async (client) => client.query<{
    opportunity_id: string;
    coordination_id: string;
    key: string;
    label: string;
    required_role: CoordinationRole | null;
    quantity: number | null;
  }>(
    `SELECT opportunity_id, coordination_id, key, label, required_role, quantity
       FROM coordination_opportunities
      WHERE coordination_id = $1
        AND removed_at_unix IS NULL
      ORDER BY created_at_unix, opportunity_id`,
    [coordinationId],
  ));

  return result.rows.map((row) => ({
    opportunityId: row.opportunity_id,
    coordinationId: row.coordination_id,
    key: row.key,
    label: row.label,
    requiredRole: row.required_role,
    quantity: row.quantity,
  }));
}

export async function listCoordinationGoals(coordinationId: string): Promise<CoordinationGoal[]> {
  const result = await withTransaction(async (client) => client.query<{
    goal_id: string;
    coordination_id: string;
    tag: string;
    minimum: number;
  }>(
    `SELECT goal_id, coordination_id, tag, minimum
       FROM coordination_goals
      WHERE coordination_id = $1
      ORDER BY created_at_unix, goal_id`,
    [coordinationId],
  ));

  return result.rows.map((row) => ({
    goalId: row.goal_id,
    coordinationId: row.coordination_id,
    tag: row.tag,
    minimum: row.minimum,
  }));
}
