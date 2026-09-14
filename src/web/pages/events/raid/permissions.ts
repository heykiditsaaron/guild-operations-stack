import type { FastifyInstance } from "fastify";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../../auth.js";
import {
  RAID_PERMISSIONS_CAPABILITY,
  guildieHasGuildCapabilityOrOperator,
} from "../../../../guild-permissions.js";
import { isConfiguredOperator } from "../../../../operator-authority.js";
import {
  raidRankPermissions,
  setRaidRankPermissions,
  type RaidRankPermissionUpdate,
} from "../../../../modules/raid/permissions.js";
import type { AssetRegistry } from "../../../assets.js";
import { htmlText, renderPage, type SecondaryNavigation } from "../../../render.js";
import { viewerForRequest } from "../../../viewer.js";

type PermissionBody = {
  updates?: unknown;
};

const navigation: SecondaryNavigation = {
  kind: "breadcrumb",
  items: [
    { label: "Administration", href: "/admin/general" },
    { label: "Permissions", href: "/admin/permissions" },
    { label: "Raid" },
  ],
};

function permissionRows(ranks: Awaited<ReturnType<typeof raidRankPermissions>>): string {
  return ranks.map((rank) => `<tr data-raid-permission-rank data-rank-index="${rank.rankIndex}">
    <th scope="row">
      <strong>${htmlText(rank.displayName)}</strong>
      <span>Rank ${rank.rankIndex}${rank.active ? "" : " · inactive"}</span>
    </th>
    <td><label><input type="checkbox" data-raid-permission-create${rank.canCreate ? " checked" : ""}> <span>Create raids</span></label></td>
    <td><label><input type="checkbox" data-raid-permission-manage${rank.canManage ? " checked" : ""}> <span>Manage raids</span></label></td>
  </tr>`).join("\n");
}

function validUpdates(value: unknown): value is RaidRankPermissionUpdate[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const update = item as Record<string, unknown>;
    return Number.isInteger(update.rankIndex)
      && typeof update.canCreate === "boolean"
      && typeof update.canManage === "boolean";
  });
}

export async function registerRaidPermissionsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/admin/raid/permissions", async (_request, reply) => reply.redirect("/admin/permissions/raid"));

  app.get("/admin/permissions/raid", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
    ]);
    const authorized = guildie
      ? await guildieHasGuildCapabilityOrOperator(guildie.guildieId, RAID_PERMISSIONS_CAPABILITY)
      : false;

    if (!guildie || !authorized) {
      const html = renderPage(assets, {
        pathname: "/admin/permissions/raid",
        title: "Raid Permissions · OH CRIT I Pulled! Guild Operations",
        viewer,
        stylesheets: ["admin.css", "raid-admin.css", "raid-permissions.css"],
        secondaryNavigation: navigation,
        header: `<div class="admin-page-header"><h1>Raid permissions</h1></div>`,
        body: `<section class="admin-unavailable"><h2>Raid permission administration is not available for this account.</h2></section>`,
      });
      return reply.code(guildie ? 403 : 401).header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
    }

    const ranks = await raidRankPermissions();
    const operator = isConfiguredOperator(guildie.guildieId);
    const body = `<section class="raid-permission-admin" aria-labelledby="raid-permission-heading">
      <div class="raid-permission-summary">
        <h2 id="raid-permission-heading">Rank mapping</h2>
        <p>Map Blizzard guild ranks to Raid capabilities. Permission administration itself remains restricted to rank 0.</p>
        ${operator ? `<p class="raid-operator-notice"><strong>Operator override active.</strong> This access is independent of your current guild rank.</p>` : ""}
      </div>
      <form data-raid-permissions-form>
        <div class="raid-permission-table-wrap">
          <table class="raid-permission-table">
            <thead><tr><th>Guild rank</th><th>Create</th><th>Manage</th></tr></thead>
            <tbody>${permissionRows(ranks)}</tbody>
          </table>
        </div>
        <div class="raid-permission-actions">
          <button type="submit" class="button-primary">Save permissions</button>
          <p data-raid-permissions-status role="status" aria-live="polite"></p>
        </div>
      </form>
    </section>`;

    const html = renderPage(assets, {
      pathname: "/admin/permissions/raid",
      title: "Raid Permissions · OH CRIT I Pulled! Guild Operations",
      description: "Configure Raid capabilities by current Blizzard guild rank.",
      viewer,
      stylesheets: ["admin.css", "raid-admin.css", "raid-permissions.css"],
      scripts: ["admin.js", "raid-permissions.js"],
      secondaryNavigation: navigation,
      header: `<div class="admin-page-header"><h1>Raid permissions</h1><p class="lede">Control who can create and operate raids.</p></div>`,
      body,
    });

    return reply.header("Cache-Control", "no-cache").type("text/html; charset=utf-8").send(html);
  });

  const savePermissions = async (request: Parameters<Parameters<FastifyInstance["post"]>[1]>[0], reply: Parameters<Parameters<FastifyInstance["post"]>[1]>[1]) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "Authentication required" });

    const body = (request.body ?? {}) as PermissionBody;
    if (!validUpdates(body.updates)) return reply.code(400).send({ error: "Raid permission mapping is invalid" });

    try {
      await setRaidRankPermissions(guildie.guildieId, body.updates);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Raid permissions could not be updated";
      const statusCode = message.includes("lacks required guild capability") ? 403 : 400;
      return reply.code(statusCode).send({ error: message });
    }
  };

  app.post("/admin/permissions/raid", savePermissions);
  app.post("/admin/raid/permissions", savePermissions);
}
