import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import { RAID_CREATE_CAPABILITY, guildieHasGuildCapability } from "../../../../guild-permissions.js";
import { raidsForAdministration } from "../../../../modules/raid/admin-view.js";
import { createRaid } from "../../../../modules/raid/application.js";
import type { RaidDifficulty, RaidEligibility } from "../../../../modules/raid/domain.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type SecondaryNavigation } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type RaidCreateRequestBody = {
  label?: unknown;
  description?: unknown;
  occursAt?: unknown;
  eligibility?: unknown;
  difficulty?: unknown;
};

const navigation: SecondaryNavigation = {
  kind: "breadcrumb",
  items: [
    { label: "Administration", href: "/admin" },
    { label: "Raid" },
  ],
};

function eligibilityLabel(value: RaidEligibility): string {
  if (value === "guild_character_member") return "Guild Character Member";
  if (value === "guildie") return "Guildie";
  return "Anyone";
}

function difficultyLabel(value: RaidDifficulty): string {
  return value[0].toUpperCase() + value.slice(1);
}

function createForm(): string {
  return `<form class="raid-admin-form" data-raid-create-form>
    <label><span>Raid name</span><input name="label" type="text" required></label>
    <label><span>Description <small>(optional)</small></span><textarea name="description" rows="3"></textarea></label>
    <label><span>Start time</span><input name="startsAt" type="datetime-local" required></label>
    <label><span>Difficulty</span><select name="difficulty" required>
      <option value="normal">Normal</option>
      <option value="heroic">Heroic</option>
      <option value="mythic">Mythic</option>
    </select></label>
    <label><span>Eligibility</span><select name="eligibility" required>
      <option value="guild_character_member">Guild Character Member</option>
      <option value="guildie">Guildie</option>
      <option value="anyone">Anyone</option>
    </select></label>
    <button type="submit" class="button-primary">Create raid</button>
    <p data-raid-create-status role="status" aria-live="polite"></p>
  </form>`;
}

async function raidList(): Promise<string> {
  const raids = await raidsForAdministration();
  if (raids.length === 0) return `<p class="raid-admin-empty">No raids have been created yet.</p>`;

  return `<div class="raid-admin-list">${raids.map((raid) => {
    const start = raid.occursAt[0];
    const stateLabel = raid.signupsOpen ? "Signups open" : "Upcoming";
    return `<article class="raid-admin-card${raid.signupsOpen ? " raid-admin-card-open" : ""}">
      <div class="raid-admin-card-heading">
        <div class="raid-admin-card-identity">
          <h2>${htmlText(raid.label)}</h2>
          <p>Starts <time data-unix-time="${start}">${start}</time></p>
        </div>
        <span class="raid-admin-card-state">${stateLabel}</span>
      </div>
      ${raid.description ? `<p class="raid-admin-card-description">${htmlText(raid.description)}</p>` : ""}
      <dl class="raid-admin-card-facts">
        <dt>Difficulty</dt><dd>${htmlText(difficultyLabel(raid.difficulty))}</dd>
        <dt>Eligibility</dt><dd>${htmlText(eligibilityLabel(raid.eligibility))}</dd>
      </dl>
      <div class="raid-admin-card-actions">
        <a class="button-primary" href="/admin/raid/${encodeURIComponent(raid.raidId)}">Manage</a>
      </div>
    </article>`;
  }).join("\n")}</div>`;
}

function validEligibility(value: unknown): value is RaidEligibility {
  return value === "guild_character_member" || value === "guildie" || value === "anyone";
}

function validDifficulty(value: unknown): value is RaidDifficulty {
  return value === "normal" || value === "heroic" || value === "mythic";
}

export async function registerRaidAdminPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/raid", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([viewerForRequest(sessionToken), authenticatedGuildie(sessionToken)]);
    const authorized = guildie ? await guildieHasGuildCapability(guildie.guildieId, RAID_CREATE_CAPABILITY) : false;

    const body = authorized
      ? `<section class="raid-admin-overview" aria-labelledby="page-title">
          <div class="raid-admin-setup" data-raid-setup hidden>${createForm()}</div>
          ${await raidList()}
        </section>`
      : `<section class="admin-unavailable"><h2>Raid administration is not available for this account.</h2></section>`;

    const html = renderPage(assets, {
      pathname: "/admin/raid",
      title: "Raid Administration · OH CRIT I Pulled! Guild Operations",
      description: "Create and operate Guild Operations raids.",
      viewer,
      stylesheets: ["admin.css", "raid-admin.css"],
      scripts: ["admin.js", "raid-admin.js"],
      secondaryNavigation: navigation,
      header: authorized
        ? `<div class="admin-page-header-row"><div class="admin-page-header"><h1 id="page-title">Raid</h1><p class="lede">Create raids and operate participation.</p></div><button class="button-primary raid-admin-header-action" type="button" data-toggle-raid-setup>New raid</button></div>`
        : `<div class="admin-page-header"><h1 id="page-title">Raid</h1><p class="lede">Create raids and operate participation.</p></div>`,
      body,
    });

    if (!guildie) return reply.code(401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    if (!authorized) return reply.code(403).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  app.post("/admin/raid", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const guildie = await authenticatedGuildie(sessionToken);
    if (!guildie) return reply.code(401).send({ error: "Authentication required" });

    const body = (request.body ?? {}) as RaidCreateRequestBody;
    if (typeof body.label !== "string") return reply.code(400).send({ error: "Raid name is required" });
    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") return reply.code(400).send({ error: "Raid description must be text" });
    if (!Array.isArray(body.occursAt) || body.occursAt.length !== 1 || typeof body.occursAt[0] !== "number") return reply.code(400).send({ error: "Raid start time is required" });
    if (!validDifficulty(body.difficulty)) return reply.code(400).send({ error: "Raid difficulty is invalid" });
    if (!validEligibility(body.eligibility)) return reply.code(400).send({ error: "Raid eligibility is invalid" });

    try {
      const raid = await createRaid(guildie.guildieId, {
        label: body.label,
        description: typeof body.description === "string" ? body.description : null,
        occursAt: [body.occursAt[0]],
        difficulty: body.difficulty,
        eligibility: body.eligibility,
      });
      return reply.code(201).send({ raid });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Raid could not be created";
      const statusCode = message.includes("lacks required guild capability") ? 403 : 400;
      return reply.code(statusCode).send({ error: message });
    }
  });
}
