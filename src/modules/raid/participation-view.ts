import { characterMembership } from "../../core/guild/character-membership.js";
import { controlledCharactersForGuildie } from "../../core/identity/controlled-characters.js";
import { pool } from "../../db.js";
import { effectiveGuildAuthority } from "../../core/authority/guild-permissions.js";
import { specHasTrait, specsForClass } from "../../wow-traits/registry.js";
import { raidEventFacts, type RaidEventFacts } from "./application.js";
import type { RaidRole } from "./domain.js";

export type RaidParticipationCharacter = {
  region: string;
  realmId: string;
  characterId: string;
  name: string;
  realmName: string | null;
  className: string;
  specs: readonly string[];
  roles: readonly RaidRole[];
};

export type RaidSignupView = {
  signupRowId: string;
  applicantId: string;
  anchorKind: "guildie" | "external";
  anchorValue: string;
  resolvedGuildieId: string | null;
  characterName: string | null;
  realmName: string | null;
  className: string;
  willingSpecs: string[];
  willingRoles: RaidRole[];
  assignmentId: string | null;
  selectedSpec: string | null;
  selectedRole: RaidRole | null;
  deniedAtUnix: number | null;
  deniedByGuildieId: string | null;
  withdrawnAtUnix: number | null;
};

function rolesForSpecs(className: string, specs: readonly string[]): RaidRole[] {
  const roles: RaidRole[] = [];
  if (specs.some((spec) => specHasTrait(className, spec, "role.tank"))) roles.push("tank");
  if (specs.some((spec) => specHasTrait(className, spec, "role.healer"))) roles.push("healer");
  if (specs.some((spec) => specHasTrait(className, spec, "role.damage"))) roles.push("damage");
  return roles;
}

export async function raidParticipationCharacters(
  raidId: string,
  guildieId: string,
): Promise<{ raid: RaidEventFacts; characters: RaidParticipationCharacter[] }> {
  const raid = await raidEventFacts(raidId);
  if (!raid) throw new Error("Raid not found");

  if (raid.eligibility !== "anyone") {
    const authority = await effectiveGuildAuthority(guildieId, raid.guildId);
    if (!authority) throw new Error("Applicant is not a current Guildie");
  }

  const controlled = await controlledCharactersForGuildie(guildieId);
  const eligible = [] as typeof controlled;

  for (const character of controlled) {
    if (!character.className) continue;
    if (raid.eligibility === "guild_character_member") {
      const membership = await characterMembership({
        guildId: raid.guildId,
        region: character.region,
        realmId: character.realmId,
        characterId: character.characterId,
      });
      if (!membership) continue;
    }
    eligible.push(character);
  }

  return {
    raid,
    characters: eligible.map((character) => {
      const className = character.className!;
      const specs = specsForClass(className);
      return {
        region: character.region,
        realmId: character.realmId,
        characterId: character.characterId,
        name: character.name,
        realmName: character.realmName,
        className,
        specs,
        roles: rolesForSpecs(className, specs),
      };
    }),
  };
}

async function raidSignupRows(raidId: string, includeWithdrawn: boolean): Promise<RaidSignupView[]> {
  const result = await pool.query<{
    signup_row_id: string;
    applicant_id: string;
    anchor_kind: "guildie" | "external";
    anchor_value: string;
    resolved_guildie_id: string | null;
    character_name: string | null;
    realm_name: string | null;
    class_name: string | null;
    declared_class: string | null;
    willing_specs: string[];
    assignment_id: string | null;
    selected_spec: string | null;
    selected_role: RaidRole | null;
    denied_at_unix: string | number | null;
    denied_by_guildie_id: string | null;
    withdrawn_at_unix: string | number | null;
  }>(
    `SELECT
       rr.signup_row_id,
       rr.applicant_id,
       ra.anchor_kind,
       ra.anchor_value,
       ra.resolved_guildie_id,
       COALESCE(wcp.name, c.name) AS character_name,
       COALESCE(wcp.realm_name, c.realm_name) AS realm_name,
       wcp.class_name,
       rr.declared_class,
       rr.willing_specs,
       ras.assignment_id,
       ras.selected_spec,
       ras.selected_role,
       rsd.denied_at_unix,
       rsd.denied_by_guildie_id,
       rr.withdrawn_at_unix
     FROM raid_signup_rows rr
     JOIN raid_applicants ra ON ra.applicant_id = rr.applicant_id
     LEFT JOIN characters c
       ON c.region = rr.character_region
      AND c.realm_id = rr.character_realm_id
      AND c.character_id = rr.character_id
     LEFT JOIN wow_character_profiles wcp
       ON wcp.region = rr.character_region
      AND wcp.realm_id = rr.character_realm_id
      AND wcp.character_id = rr.character_id
     LEFT JOIN raid_assignments ras ON ras.signup_row_id = rr.signup_row_id
     LEFT JOIN raid_signup_denials rsd ON rsd.raid_id = rr.raid_id AND rsd.signup_row_id = rr.signup_row_id
     WHERE rr.raid_id = $1
       AND ($2::boolean OR rr.withdrawn_at_unix IS NULL)
     ORDER BY rr.created_at_unix ASC, rr.signup_row_id ASC`,
    [raidId, includeWithdrawn],
  );

  return result.rows.map((row) => {
    const className = row.class_name ?? row.declared_class ?? "Unknown";
    return {
      signupRowId: row.signup_row_id,
      applicantId: row.applicant_id,
      anchorKind: row.anchor_kind,
      anchorValue: row.anchor_value,
      resolvedGuildieId: row.resolved_guildie_id,
      characterName: row.character_name,
      realmName: row.realm_name,
      className,
      willingSpecs: row.willing_specs,
      willingRoles: className === "Unknown" ? [] : rolesForSpecs(className, row.willing_specs),
      assignmentId: row.assignment_id,
      selectedSpec: row.selected_spec,
      selectedRole: row.selected_role,
      deniedAtUnix: row.denied_at_unix === null ? null : Number(row.denied_at_unix),
      deniedByGuildieId: row.denied_by_guildie_id,
      withdrawnAtUnix: row.withdrawn_at_unix === null ? null : Number(row.withdrawn_at_unix),
    };
  });
}

export async function raidSignups(raidId: string): Promise<RaidSignupView[]> {
  return raidSignupRows(raidId, false);
}

export async function raidSignup(raidId: string, signupRowId: string): Promise<RaidSignupView | null> {
  return (await raidSignupRows(raidId, true)).find((row) => row.signupRowId === signupRowId) ?? null;
}

export async function raidAssignment(raidId: string, signupRowId: string): Promise<Pick<RaidSignupView, "assignmentId" | "selectedSpec" | "selectedRole"> | null> {
  const signup = await raidSignup(raidId, signupRowId);
  if (!signup?.assignmentId) return null;
  return {
    assignmentId: signup.assignmentId,
    selectedSpec: signup.selectedSpec,
    selectedRole: signup.selectedRole,
  };
}

export async function raidSignupsForGuildie(raidId: string, guildieId: string): Promise<RaidSignupView[]> {
  return (await raidSignups(raidId)).filter(
    (row) => row.anchorKind === "guildie" && row.anchorValue === guildieId,
  );
}


export async function activeRaidSignups(raidId: string): Promise<RaidSignupView[]> {
  return (await raidSignupRows(raidId, false)).filter((row) => row.deniedAtUnix === null);
}


export async function raidParticipationReferencesForGuildie(
  guildieId: string,
): Promise<readonly { raidId: string; signupRowId: string }[]> {
  const result = await pool.query<{ raid_id: string; signup_row_id: string }>(
    `SELECT rr.raid_id, rr.signup_row_id
       FROM raid_signup_rows rr
       JOIN raid_applicants ra ON ra.applicant_id = rr.applicant_id
      WHERE ra.anchor_kind = 'guildie'
        AND ra.anchor_value = $1
      ORDER BY rr.created_at_unix DESC, rr.signup_row_id DESC`,
    [guildieId],
  );
  return result.rows.map((row) => ({ raidId: row.raid_id, signupRowId: row.signup_row_id }));
}
