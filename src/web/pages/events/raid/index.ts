import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raidEventFacts, submitRaidParticipationRow } from "../../../../modules/raid/application.js";
import {
  raidParticipationCharacters,
  raidSignupRowsForGuildie,
  type RaidParticipationCharacter,
} from "../../../../modules/raid/participation-view.js";
import type { RaidRole } from "../../../../modules/raid/domain.js";
import {
  allWowClassTraitDefinitions,
  specHasTrait,
  specsForClass,
} from "../../../../wow-traits/registry.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaidParams = { raidId: string };
type SignupBody = {
  character?: unknown;
  declaredClass?: unknown;
  willingSpecs?: unknown;
  willingRoles?: unknown;
};

function roleLabel(role: RaidRole): string {
  return role === "damage" ? "Damage" : role === "healer" ? "Healer" : "Tank";
}

function rolesForClass(className: string): RaidRole[] {
  const specs = specsForClass(className);
  const roles: RaidRole[] = [];
  if (specs.some((spec) => specHasTrait(className, spec, "role.tank"))) roles.push("tank");
  if (specs.some((spec) => specHasTrait(className, spec, "role.healer"))) roles.push("healer");
  if (specs.some((spec) => specHasTrait(className, spec, "role.damage"))) roles.push("damage");
  return roles;
}

function encoded(values: readonly string[]): string {
  return encodeURIComponent(JSON.stringify(values));
}

function characterOption(character: RaidParticipationCharacter): string {
  const label = `${character.name}${character.realmName ? ` — ${character.realmName}` : ""} · ${character.className}`;
  return `<option
    value="character:${htmlText(character.region)}:${htmlText(character.realmId)}:${htmlText(character.characterId)}"
    data-kind="character"
    data-region="${htmlText(character.region)}"
    data-realm-id="${htmlText(character.realmId)}"
    data-character-id="${htmlText(character.characterId)}"
    data-class-name="${htmlText(character.className)}"
    data-specs="${encoded(character.specs)}"
    data-roles="${encoded(character.roles)}"
  >${htmlText(label)}</option>`;
}

function participationEditor(characters: RaidParticipationCharacter[], allowDeclaredClass: boolean): string {
  const classOptions = allowDeclaredClass
    ? allWowClassTraitDefinitions()
        .map((definition) => {
          const specs = specsForClass(definition.className);
          const roles = rolesForClass(definition.className);
          return `<option
            value="class:${htmlText(definition.className)}"
            data-kind="class"
            data-class-name="${htmlText(definition.className)}"
            data-specs="${encoded(specs)}"
            data-roles="${encoded(roles)}"
          >Declare ${htmlText(definition.className)}</option>`;
        })
        .join("")
    : "";

  return `<section class="raid-participation" aria-labelledby="raid-offer-heading">
    <div>
      <h2 id="raid-offer-heading">Offer participation</h2>
      <p>Choose one character you are willing to bring${allowDeclaredClass ? ", or declare a class" : ""}.</p>
    </div>
    <form class="raid-offer-form" data-raid-signup-form>
      <label class="raid-offer-selector">
        <span>Participation option</span>
        <select name="participation" data-raid-participation-choice required>
          <option value="">Select a character…</option>
          ${characters.map(characterOption).join("\n")}
          ${classOptions ? `<optgroup label="Class declaration">${classOptions}</optgroup>` : ""}
        </select>
      </label>
      <div class="raid-offer-editor" data-raid-offer-editor hidden>
        <div class="raid-offer-identity" data-raid-offer-identity></div>
        <fieldset data-raid-specs><legend>Specializations you are willing to play</legend></fieldset>
        <fieldset data-raid-roles><legend>Roles you are willing to fill</legend></fieldset>
        <button type="submit" class="button-primary">Offer participation</button>
      </div>
      <p data-raid-signup-status role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export async function registerRaidPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get<{ Params: RaidParams }>("/events/raid/:raidId", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie, raid] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
      raidEventFacts(request.params.raidId),
    ]);
    if (!raid) return reply.code(404).send({ error: "Raid not found" });

    let participation = "";
    let ownRows = "";

    if (!raid.signupsOpen) {
      participation = `<section class="raid-signup-state"><h2>Signups are closed</h2><p>This raid is not currently accepting participation offers.</p></section>`;
    } else if (!guildie) {
      participation = `<section class="raid-signup-state"><h2>Sign in to participate</h2><p>This web signup surface currently accepts Guild Operations members. External intake will use its own producer when that integration exists.</p></section>`;
    } else {
      try {
        const [{ characters }, rows] = await Promise.all([
          raidParticipationCharacters(raid.raidId, guildie.guildieId),
          raidSignupRowsForGuildie(raid.raidId, guildie.guildieId),
        ]);
        const allowDeclaredClass = raid.eligibility === "anyone";
        participation = characters.length || allowDeclaredClass
          ? participationEditor(characters, allowDeclaredClass)
          : `<section class="raid-signup-state"><h2>No eligible characters</h2><p>No currently controlled character is eligible for this raid.</p></section>`;
        ownRows = rows.length
          ? `<section class="raid-my-offers"><h2>Your participation offers</h2><div>${rows.map((row) => `<article><strong>${htmlText(row.characterName ?? row.className)}</strong><span>${row.realmName ? `${htmlText(row.realmName)} · ` : ""}${htmlText(row.className)}</span><span>${row.willingSpecs.map(htmlText).join(", ")} · ${row.willingRoles.map((role) => htmlText(roleLabel(role))).join(", ")}</span>${row.assignedSlotIndex !== null ? `<span>Assigned to slot ${row.assignedSlotIndex} as ${htmlText(row.selectedSpec ?? "")} ${htmlText(roleLabel(row.selectedRole!))}</span>` : ""}</article>`).join("")}</div></section>`
          : "";
      } catch (error) {
        participation = `<section class="raid-signup-state"><h2>Not eligible</h2><p>${htmlText(error instanceof Error ? error.message : "You are not eligible to participate in this raid.")}</p></section>`;
      }
    }

    const html = renderPage(assets, {
      pathname: request.url,
      title: `${raid.label} · Raid · OH CRIT I Pulled! Guild Operations`,
      description: raid.description ?? "Guild raid participation.",
      viewer,
      stylesheets: ["raid.css"],
      scripts: ["raid.js"],
      secondaryNavigation: { kind: "back", label: "Events", href: "/events" },
      header: `<div><h1>${htmlText(raid.label)}</h1>${raid.description ? `<p class="lede">${htmlText(raid.description)}</p>` : ""}<p><time data-unix-time="${raid.occursAt[0]}">${raid.occursAt[0]}</time> · ${raid.raidSize} player raid</p></div>`,
      body: `${participation}${ownRows}`,
    });
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.post<{ Params: RaidParams; Body: SignupBody }>("/events/raid/:raidId/signup", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "Authentication required" });

    const character = request.body?.character;
    const declaredClass = request.body?.declaredClass;
    const willingSpecs = request.body?.willingSpecs;
    const willingRoles = request.body?.willingRoles;
    if (!Array.isArray(willingSpecs) || !willingSpecs.every((value) => typeof value === "string")) return reply.code(400).send({ error: "Specializations are required" });
    if (!Array.isArray(willingRoles) || !willingRoles.every((value) => value === "tank" || value === "healer" || value === "damage")) return reply.code(400).send({ error: "Roles are required" });

    let participationKey;
    if (typeof declaredClass === "string" && declaredClass.trim()) {
      participationKey = { declaredClass: declaredClass.trim() } as const;
    } else {
      if (!character || typeof character !== "object") return reply.code(400).send({ error: "Character or declared class is required" });
      const coordinate = character as Record<string, unknown>;
      if (typeof coordinate.region !== "string" || typeof coordinate.realmId !== "string" || typeof coordinate.characterId !== "string") {
        return reply.code(400).send({ error: "Character reference is invalid" });
      }
      participationKey = {
        character: {
          region: coordinate.region,
          realmId: coordinate.realmId,
          characterId: coordinate.characterId,
        },
      } as const;
    }

    try {
      const signupRowId = await submitRaidParticipationRow({
        raidId: request.params.raidId,
        applicantAnchor: { kind: "guildie", value: guildie.guildieId },
        participationKey,
        willingSpecs,
        willingRoles: willingRoles as RaidRole[],
      });
      return reply.code(201).send({ signupRowId });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Participation could not be submitted" });
    }
  });
}
