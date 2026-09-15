import { characterMembership } from "../../application-state.js";
import { controlledCharactersForGuildie } from "../../controlled-characters.js";
import { pool } from "../../db.js";
import { effectiveGuildAuthority } from "../../guild-permissions.js";
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

export type RaidSignupRowView = {
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

export async function raidSignupRows(raidId: string): Promise<RaidSignupRowView[]> {
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
       ras.selected_role
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
     WHERE rr.raid_id = $1
       AND rr.withdrawn_at_unix IS NULL
     ORDER BY rr.created_at_unix ASC, rr.signup_row_id ASC`,
    [raidId],
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
    };
  });
}

export async function raidSignupRowsForGuildie(raidId: string, guildieId: string): Promise<RaidSignupRowView[]> {
  return (await raidSignupRows(raidId)).filter(
    (row) => row.anchorKind === "guildie" && row.anchorValue === guildieId,
  );
}
