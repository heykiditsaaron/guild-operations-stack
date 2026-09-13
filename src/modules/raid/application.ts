import { config } from "../../config.js";
import { controlledCharactersForGuildie } from "../../controlled-characters.js";
import { pool, withTransaction } from "../../db.js";
import { effectiveGuildAuthority, RAID_CREATE_CAPABILITY, requireGuildCapability } from "../../guild-permissions.js";
import { characterMembership } from "../../application-state.js";
import { traitsForSpec, type WowTrait } from "../../wow-traits/registry.js";
import {
  normalizedStrings,
  validateCreateRaidInput,
  validateParticipationWillingness,
  validateSelectedConfiguration,
  type AssignRaidParticipationInput,
  type CreateRaidInput,
  type RaidApplicantAnchor,
  type RaidEligibility,
  type RaidRole,
  type SubmitRaidParticipationRowInput,
} from "./domain.js";

export type RaidEventFacts = {
  raidId: string;
  guildId: string;
  label: string;
  description: string | null;
  occursAt: readonly [number] | readonly [number, number];
  tags: string[];
  eligibility: RaidEligibility;
  raidSize: number;
  signupsOpen: boolean;
};

async function resolveApplicantGuildie(anchor: RaidApplicantAnchor): Promise<string | null> {
  if (anchor.kind === "guildie") {
    const result = await pool.query<{ guildie_id: string }>(
      "SELECT guildie_id FROM guildies WHERE guildie_id = $1",
      [anchor.value],
    );
    return result.rows[0]?.guildie_id ?? null;
  }

  const result = await pool.query<{ guildie_id: string }>(
    "SELECT guildie_id FROM discord_associations WHERE discord_user_id = $1",
    [anchor.value],
  );
  return result.rows[0]?.guildie_id ?? null;
}

export async function raidEventFacts(raidId: string): Promise<RaidEventFacts | null> {
  const result = await pool.query<{
    raid_id: string;
    guild_id: string;
    label: string;
    description: string | null;
    occurs_start_unix: string;
    occurs_end_unix: string | null;
    tags: string[];
    eligibility: RaidEligibility;
    raid_size: number;
    signups_open: boolean;
  }>(
    `SELECT raid_id, guild_id, label, description, occurs_start_unix, occurs_end_unix,
            tags, eligibility, raid_size, signups_open
       FROM raid_events
      WHERE raid_id = $1`,
    [raidId],
  );

  const row = result.rows[0];
  if (!row) return null;
  const start = Number(row.occurs_start_unix);
  const end = row.occurs_end_unix === null ? null : Number(row.occurs_end_unix);
  return {
    raidId: row.raid_id,
    guildId: row.guild_id,
    label: row.label,
    description: row.description,
    occursAt: end === null ? [start] : [start, end],
    tags: row.tags,
    eligibility: row.eligibility,
    raidSize: row.raid_size,
    signupsOpen: row.signups_open,
  };
}

export async function createRaid(actorGuildieId: string, input: CreateRaidInput): Promise<RaidEventFacts> {
  validateCreateRaidInput(input);
  await requireGuildCapability(actorGuildieId, RAID_CREATE_CAPABILITY);
  const tags = normalizedStrings(input.tags ?? ["raid"]);

  const result = await pool.query<{ raid_id: string }>(
    `INSERT INTO raid_events (
       guild_id, label, description, occurs_start_unix, occurs_end_unix, tags,
       eligibility, raid_size, created_by_guildie_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING raid_id`,
    [
      config.guild.id,
      input.label.trim(),
      input.description?.trim() || null,
      input.occursAt[0],
      input.occursAt.length === 2 ? input.occursAt[1] : null,
      tags,
      input.eligibility,
      input.raidSize,
      actorGuildieId,
    ],
  );

  const facts = await raidEventFacts(result.rows[0].raid_id);
  if (!facts) throw new Error("Created Raid could not be reloaded");
  return facts;
}

export async function setRaidSignupsOpen(actorGuildieId: string, raidId: string, open: boolean): Promise<void> {
  await requireGuildCapability(actorGuildieId, RAID_CREATE_CAPABILITY);
  const result = await pool.query(
    `UPDATE raid_events
        SET signups_open = $2,
            updated_at_unix = extract(epoch FROM now())::bigint
      WHERE raid_id = $1`,
    [raidId, open],
  );
  if (!result.rowCount) throw new Error("Raid not found");
}

async function assertApplicantEligible(raid: RaidEventFacts, guildieId: string | null): Promise<void> {
  if (raid.eligibility === "anyone") return;
  if (!guildieId) throw new Error("Raid eligibility requires a Guildie");
  const authority = await effectiveGuildAuthority(guildieId, raid.guildId);
  if (!authority) throw new Error("Applicant is not a current Guildie");
}

async function participationClass(
  raid: RaidEventFacts,
  guildieId: string | null,
  input: SubmitRaidParticipationRowInput,
): Promise<{ className: string; character: { region: string; realmId: string; characterId: string } | null }> {
  if ("declaredClass" in input.participationKey) {
    if (raid.eligibility !== "anyone") throw new Error("Declared-class rows are only valid for anyone eligibility");
    const className = input.participationKey.declaredClass.trim();
    if (!className) throw new Error("Declared class is required");
    return { className, character: null };
  }

  if (!guildieId) throw new Error("Character rows require a resolved Guildie");
  const coordinate = input.participationKey.character;
  const characters = await controlledCharactersForGuildie(guildieId);
  const character = characters.find((candidate) =>
    candidate.region === coordinate.region
      && candidate.realmId === coordinate.realmId
      && candidate.characterId === coordinate.characterId,
  );
  if (!character) throw new Error("Character is not currently controlled by the applicant");
  if (!character.className) throw new Error("Character class facts are not available");

  if (raid.eligibility === "guild_character_member") {
    const membership = await characterMembership({
      guildId: raid.guildId,
      region: character.region,
      realmId: character.realmId,
      characterId: character.characterId,
    });
    if (!membership) throw new Error("Character is not a current member of the guild roster");
  }

  return {
    className: character.className,
    character: {
      region: character.region,
      realmId: character.realmId,
      characterId: character.characterId,
    },
  };
}

export async function submitRaidParticipationRow(input: SubmitRaidParticipationRowInput): Promise<string> {
  const raid = await raidEventFacts(input.raidId);
  if (!raid) throw new Error("Raid not found");
  if (!raid.signupsOpen) throw new Error("Raid signups are not open");

  const resolvedGuildieId = await resolveApplicantGuildie(input.applicantAnchor);
  await assertApplicantEligible(raid, resolvedGuildieId);
  const participation = await participationClass(raid, resolvedGuildieId, input);
  const willingSpecs = normalizedStrings(input.willingSpecs);
  const willingRoles = [...new Set(input.willingRoles)];
  validateParticipationWillingness(participation.className, willingSpecs, willingRoles);

  return withTransaction(async (client) => {
    const applicantResult = await client.query<{ applicant_id: string }>(
      `INSERT INTO raid_applicants (raid_id, anchor_kind, anchor_value, resolved_guildie_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (raid_id, anchor_kind, anchor_value) DO UPDATE
         SET resolved_guildie_id = COALESCE(EXCLUDED.resolved_guildie_id, raid_applicants.resolved_guildie_id)
       RETURNING applicant_id`,
      [input.raidId, input.applicantAnchor.kind, input.applicantAnchor.value, resolvedGuildieId],
    );
    const applicantId = applicantResult.rows[0].applicant_id;

    const rowResult = await client.query<{ signup_row_id: string }>(
      `INSERT INTO raid_signup_rows (
         raid_id, applicant_id, character_region, character_realm_id, character_id,
         declared_class, willing_specs, willing_roles
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING signup_row_id`,
      [
        input.raidId,
        applicantId,
        participation.character?.region ?? null,
        participation.character?.realmId ?? null,
        participation.character?.characterId ?? null,
        participation.character ? null : participation.className,
        willingSpecs,
        willingRoles,
      ],
    );
    return rowResult.rows[0].signup_row_id;
  });
}

export async function assignRaidParticipation(
  actorGuildieId: string,
  input: AssignRaidParticipationInput,
): Promise<string> {
  await requireGuildCapability(actorGuildieId, RAID_CREATE_CAPABILITY);
  const raid = await raidEventFacts(input.raidId);
  if (!raid) throw new Error("Raid not found");
  if (!Number.isInteger(input.slotIndex) || input.slotIndex < 1 || input.slotIndex > raid.raidSize) {
    throw new Error("Raid slot is outside the configured raid size");
  }

  const rowResult = await pool.query<{
    applicant_id: string;
    willing_specs: string[];
    willing_roles: RaidRole[];
    declared_class: string | null;
    class_name: string | null;
  }>(
    `SELECT rr.applicant_id, rr.willing_specs, rr.willing_roles, rr.declared_class, wcp.class_name
       FROM raid_signup_rows rr
       LEFT JOIN wow_character_profiles wcp
         ON wcp.region = rr.character_region
        AND wcp.realm_id = rr.character_realm_id
        AND wcp.character_id = rr.character_id
      WHERE rr.raid_id = $1
        AND rr.signup_row_id = $2`,
    [input.raidId, input.signupRowId],
  );
  const row = rowResult.rows[0];
  if (!row) throw new Error("Raid participation row not found");
  const className = row.class_name ?? row.declared_class;
  if (!className) throw new Error("Participation row class facts are unavailable");
  validateSelectedConfiguration(className, row.willing_specs, row.willing_roles, input.selectedSpec, input.selectedRole);

  const result = await pool.query<{ assignment_id: string }>(
    `INSERT INTO raid_assignments (
       raid_id, applicant_id, signup_row_id, slot_index, selected_spec, selected_role, assigned_by_guildie_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING assignment_id`,
    [input.raidId, row.applicant_id, input.signupRowId, input.slotIndex, input.selectedSpec, input.selectedRole, actorGuildieId],
  );
  return result.rows[0].assignment_id;
}

export async function unassignRaidSlot(actorGuildieId: string, raidId: string, slotIndex: number): Promise<void> {
  await requireGuildCapability(actorGuildieId, RAID_CREATE_CAPABILITY);
  await pool.query("DELETE FROM raid_assignments WHERE raid_id = $1 AND slot_index = $2", [raidId, slotIndex]);
}

export async function assignedRaidCapabilities(raidId: string): Promise<readonly WowTrait[]> {
  const result = await pool.query<{
    selected_spec: string;
    declared_class: string | null;
    class_name: string | null;
  }>(
    `SELECT ra.selected_spec, rr.declared_class, wcp.class_name
       FROM raid_assignments ra
       JOIN raid_signup_rows rr ON rr.signup_row_id = ra.signup_row_id
       LEFT JOIN wow_character_profiles wcp
         ON wcp.region = rr.character_region
        AND wcp.realm_id = rr.character_realm_id
        AND wcp.character_id = rr.character_id
      WHERE ra.raid_id = $1
      ORDER BY ra.slot_index`,
    [raidId],
  );

  return [...new Set<WowTrait>(result.rows.flatMap((row) => {
    const className = row.class_name ?? row.declared_class;
    return className ? traitsForSpec(className, row.selected_spec) : [];
  }))].sort();
}
