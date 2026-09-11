import { pool } from "./db.js";
import {
  addOpportunity,
  assignOffer,
  createCoordination,
  registerApplicant,
  submitOffer,
  allSpecDefinitions,
  getSpecDefinition,
} from "./group-coordinator/index.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`PASS: ${message}`);
}

async function expectFailure(label: string, operation: () => Promise<unknown>, expectedMessagePart: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedMessagePart), `${label} failed for the expected reason`);
    console.log(`      ${message}`);
    return;
  }
  throw new Error(`ASSERTION FAILED: ${label} should have been rejected`);
}

async function main(): Promise<void> {
  let coordinationId: string | null = null;

  try {
    const candidates = await pool.query<{
      guild_id: string;
      guildie_id: string;
      character_record_id: string;
      character_name: string;
      class_name: string;
      active_spec_name: string;
    }>(`
      SELECT DISTINCT
        grm.guild_id,
        c.guildie_id,
        c.character_record_id,
        c.name AS character_name,
        wcp.class_name,
        wcp.active_spec_name
      FROM characters c
      JOIN guild_roster_memberships grm
        ON grm.region = c.region
       AND grm.realm_id = c.realm_id
       AND grm.character_id = c.character_id
      JOIN wow_character_profiles wcp
        ON wcp.region = c.region
       AND wcp.realm_id = c.realm_id
       AND wcp.character_id = c.character_id
      WHERE c.currently_controlled = true
        AND grm.currently_present = true
        AND wcp.class_name IS NOT NULL
        AND wcp.active_spec_name IS NOT NULL
      ORDER BY c.name
    `);

    const profileCharacter = candidates.rows.find((row) =>
      Boolean(getSpecDefinition(row.class_name, row.active_spec_name)),
    );

    assert(profileCharacter, "dev database contains a controlled guild Character with usable Blizzard class/spec profile data");

    const {
      guild_id: guildId,
      guildie_id: guildieId,
      character_record_id: characterRecordId,
      character_name: characterName,
      class_name: observedClass,
      active_spec_name: observedSpec,
    } = profileCharacter;

    console.log("");
    console.log(`Profile-backed Character: ${characterName} — ${observedClass} / ${observedSpec}`);
    console.log("");

    coordinationId = await createCoordination({
      guildId,
      applicantEligibility: "guildie",
      organizerGuildieIds: [guildieId],
    });
    assert(Boolean(coordinationId), "Coordination created");

    const applicantId = await registerApplicant({
      coordinationId,
      source: "guildie",
      guildieId,
    });
    assert(Boolean(applicantId), "Guildie admitted as applicant");

    const derivedOfferId = await submitOffer({
      coordinationId,
      applicantId,
      characterRecordId,
    });
    assert(Boolean(derivedOfferId), "Character-backed offer accepted without caller supplying class/spec");

    const derivedOffer = await pool.query<{
      character_record_id: string | null;
      class_name: string | null;
      spec_name: string | null;
    }>(
      `SELECT character_record_id, class_name, spec_name FROM coordination_offers WHERE offer_id = $1`,
      [derivedOfferId],
    );

    assert(derivedOffer.rows[0].character_record_id === characterRecordId, "offer retains the durable Character relationship");
    assert(
      derivedOffer.rows[0].class_name === observedClass && derivedOffer.rows[0].spec_name === observedSpec,
      "offer derives observed class and active specialization from Blizzard profile state",
    );

    const activeDefinition = getSpecDefinition(observedClass, observedSpec);
    assert(activeDefinition, "derived specialization resolves through the Group Coordinator spec registry");

    const opportunityId = await addOpportunity({
      coordinationId,
      actorGuildieId: guildieId,
      key: "derived-role",
      label: "Derived Role",
      requiredRole: activeDefinition.role,
      quantity: 1,
    });

    const assignmentId = await assignOffer({
      coordinationId,
      actorGuildieId: guildieId,
      offerId: derivedOfferId,
      opportunityId,
    });
    assert(Boolean(assignmentId), "profile-derived Character offer can satisfy registry-backed role Assignment");

    const alternateSpec = allSpecDefinitions().find(
      (definition) => definition.className === observedClass && definition.specName !== observedSpec,
    );

    if (alternateSpec) {
      const alternateOfferId = await submitOffer({
        coordinationId,
        applicantId,
        characterRecordId,
        specName: alternateSpec.specName,
      });

      const alternateOffer = await pool.query<{ class_name: string | null; spec_name: string | null }>(
        `SELECT class_name, spec_name FROM coordination_offers WHERE offer_id = $1`,
        [alternateOfferId],
      );

      assert(
        alternateOffer.rows[0].class_name === observedClass && alternateOffer.rows[0].spec_name === alternateSpec.specName,
        "applicant may offer another valid specialization for the Character's observed class",
      );
    } else {
      console.log(`SKIP: ${observedClass} has no alternate specialization in the registry`);
    }

    const contradictoryDefinition = allSpecDefinitions().find((definition) => definition.className !== observedClass);
    assert(contradictoryDefinition, "registry contains another class for contradiction test");

    await expectFailure(
      "Character-backed offer cannot contradict observed Character class",
      () => submitOffer({
        coordinationId: coordinationId!,
        applicantId,
        characterRecordId,
        className: contradictoryDefinition.className,
        specName: contradictoryDefinition.specName,
      }),
      "Declared class does not match",
    );

    const offGuildAlt = await pool.query<{ character_record_id: string; character_name: string }>(
      `SELECT c.character_record_id, c.name AS character_name
         FROM characters c
         LEFT JOIN wow_character_profiles wcp
           ON wcp.region = c.region
          AND wcp.realm_id = c.realm_id
          AND wcp.character_id = c.character_id
        WHERE c.guildie_id = $1
          AND c.currently_controlled = true
          AND NOT EXISTS (
            SELECT 1
              FROM guild_roster_memberships grm
             WHERE grm.guild_id = $2
               AND grm.region = c.region
               AND grm.realm_id = c.realm_id
               AND grm.character_id = c.character_id
               AND grm.currently_present = true
          )
          AND (wcp.character_id IS NULL OR wcp.class_name IS NULL OR wcp.active_spec_name IS NULL)
        ORDER BY c.name
        LIMIT 1`,
      [guildieId, guildId],
    );

    if (offGuildAlt.rowCount) {
      const alt = offGuildAlt.rows[0];
      console.log("");
      console.log(`Testing off-guild controlled alt: ${alt.character_name}`);

      await expectFailure(
        "off-guild Character without detailed profile requires declared coordination facts",
        () => submitOffer({ coordinationId: coordinationId!, applicantId, characterRecordId: alt.character_record_id }),
        "must be declared",
      );

      const declared = allSpecDefinitions()[0];
      const altOfferId = await submitOffer({
        coordinationId,
        applicantId,
        characterRecordId: alt.character_record_id,
        className: declared.className,
        specName: declared.specName,
      });

      const altOffer = await pool.query<{
        character_record_id: string | null;
        class_name: string | null;
        spec_name: string | null;
      }>(
        `SELECT character_record_id, class_name, spec_name FROM coordination_offers WHERE offer_id = $1`,
        [altOfferId],
      );

      assert(altOffer.rows[0].character_record_id === alt.character_record_id, "off-guild controlled alt remains a real Character-backed offer");
      assert(
        altOffer.rows[0].class_name === declared.className && altOffer.rows[0].spec_name === declared.specName,
        "missing Blizzard profile facts can be supplied by applicant declaration",
      );
    } else {
      console.log("");
      console.log("SKIP: no currently controlled off-guild alt lacking detailed profile data exists for this Guildie");
      console.log("      This is a data-dependent case, not a test failure.");
    }

    console.log("");
    console.log("GROUP COORDINATOR CHARACTER-OFFER SMOKE TEST PASSED");
  } finally {
    if (coordinationId) {
      await pool.query(`DELETE FROM coordinations WHERE coordination_id = $1`, [coordinationId]);
      console.log(`Cleaned up test Coordination ${coordinationId}`);
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error("");
  console.error("GROUP COORDINATOR CHARACTER-OFFER SMOKE TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
