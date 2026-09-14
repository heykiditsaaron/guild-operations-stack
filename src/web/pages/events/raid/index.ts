import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { raidEventFacts, submitRaidParticipationRow } from "../../../../modules/raid/application.js";
import {
  raidParticipationCharacters,
  raidSignupRowsForGuildie,
  type RaidParticipationCharacter,
} from "../../../../modules/raid/participation-view.js";
import type { RaidRole } from "../../../../modules/raid/domain.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaidParams = { raidId: string };
type SignupBody = {
  character?: unknown;
  willingSpecs?: unknown;
  willingRoles?: unknown;
};

function roleLabel(role: RaidRole): string {
  return role === "damage" ? "Damage" : role === "healer" ? "Healer" : "Tank";
}

function characterForm(character: RaidParticipationCharacter): string {
  return `<article class="raid-character-offer">
    <div class="raid-character-heading">
      <h3>${htmlText(character.name)}</h3>
      <p>${htmlText(character.className)}${character.realmName ? ` · ${htmlText(character.realmName)}` : ""}</p>
    </div>
    <form data-raid-signup-form
      data-region="${htmlText(character.region)}"
      data-realm-id="${htmlText(character.realmId)}"
      data-character-id="${htmlText(character.characterId)}">
      <fieldset><legend>Specializations you are willing to play</legend>
        ${character.specs.map((spec) => `<label><input type="checkbox" name="spec" value="${htmlText(spec)}"> <span>${htmlText(spec)}</span></label>`).join("")}
      </fieldset>
      <fieldset><legend>Roles you are willing to fill</legend>
        ${character.roles.map((role) => `<label><input type="checkbox" name="role" value="${role}"> <span>${htmlText(roleLabel(role))}</span></label>`).join("")}
      </fieldset>
      <button type="submit" class="button-primary">Offer this character</button>
      <p data-raid-signup-status role="status" aria-live="polite"></p>
    </form>
  </article>`;
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
        participation = characters.length
          ? `<section class="raid-participation"><h2>Offer participation</h2><p>Select each character you are willing to bring, then choose the specs and roles you are willing to play.</p><div class="raid-character-offers">${characters.map(characterForm).join("")}</div></section>`
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
    const willingSpecs = request.body?.willingSpecs;
    const willingRoles = request.body?.willingRoles;
    if (!character || typeof character !== "object") return reply.code(400).send({ error: "Character is required" });
    const coordinate = character as Record<string, unknown>;
    if (typeof coordinate.region !== "string" || typeof coordinate.realmId !== "string" || typeof coordinate.characterId !== "string") {
      return reply.code(400).send({ error: "Character reference is invalid" });
    }
    if (!Array.isArray(willingSpecs) || !willingSpecs.every((value) => typeof value === "string")) return reply.code(400).send({ error: "Specializations are required" });
    if (!Array.isArray(willingRoles) || !willingRoles.every((value) => value === "tank" || value === "healer" || value === "damage")) return reply.code(400).send({ error: "Roles are required" });

    try {
      const signupRowId = await submitRaidParticipationRow({
        raidId: request.params.raidId,
        applicantAnchor: { kind: "guildie", value: guildie.guildieId },
        participationKey: { character: { region: coordinate.region, realmId: coordinate.realmId, characterId: coordinate.characterId } },
        willingSpecs,
        willingRoles: willingRoles as RaidRole[],
      });
      return reply.code(201).send({ signupRowId });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Participation could not be submitted" });
    }
  });
}
