import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { registerApiV1Routes } from "./api-v1-routes.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { registerAuthRoutes } from "./auth.js";
import { registerGuildRoutes } from "./guild-routes.js";
import { startGuildRefreshScheduler } from "./guild-refresh-scheduler.js";
import { registerDiscordModule, registerDiscordModuleAdministration } from "./modules/discord/module.js";
import { registerRaidAdministrationDestination } from "./modules/raid/administration.js";
import { registerRaffleAdministrationDestination } from "./modules/raffle/administration.js";
import { registerRaffleApiV1Routes } from "./modules/raffle/api-v1-routes.js";
import { reconcileRaffleCalendarListingDestinations } from "./modules/raffle/calendar-listing.js";
import { registerRaffleGuildEventOffering } from "./modules/raffle/offering.js";
import { registerRaffleRoutes } from "./modules/raffle/routes.js";
import { loadAssetRegistry, registerAssetRoutes } from "./web/assets.js";
import { registerAdminPage } from "./web/pages/admin.js";
import { registerOperationsAdminPage } from "./web/pages/operations.js";
import { registerEventsPage } from "./web/pages/events/index.js";
import { registerRaidAdminPage } from "./web/pages/events/raid/admin.js";
import { registerRaidAdminDetailPage } from "./web/pages/events/raid/detail.js";
import { registerRaidPage } from "./web/pages/events/raid/index.js";
import { registerRaidPermissionsPage } from "./web/pages/events/raid/permissions.js";
import { registerRaffleAdminPage } from "./web/pages/events/raffle/admin.js";
import { registerRaffleClaimsPage } from "./web/pages/events/raffle/claims.js";
import { registerRaffleEntryPage } from "./web/pages/events/raffle/enter.js";
import { registerRaffleHistoryPage } from "./web/pages/events/raffle/history.js";
import { registerRafflePage } from "./web/pages/events/raffle/index.js";
import { registerRaffleRoundPage } from "./web/pages/events/raffle/round.js";
import { registerRaffleRulesPage } from "./web/pages/events/raffle/rules.js";
import { registerHomePage } from "./web/pages/home.js";
import { registerSiteInformationPages } from "./web/pages/site-information.js";

const app = Fastify({
  logger: true,
  disableRequestLogging: true,
});
await app.register(cookie);
registerDiscordModuleAdministration();
registerRaidAdministrationDestination();
registerRaffleAdministrationDestination();
registerRaffleGuildEventOffering();
await reconcileRaffleCalendarListingDestinations();

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

const webAssets = await loadAssetRegistry();
await registerAssetRoutes(app, webAssets);
await registerHomePage(app, webAssets);
await registerSiteInformationPages(app, webAssets);
await registerEventsPage(app, webAssets);
await registerAdminPage(app, webAssets);
await registerOperationsAdminPage(app, webAssets);
await registerDiscordModule(app, webAssets);
await registerRaidAdminPage(app, webAssets);
await registerRaidAdminDetailPage(app, webAssets);
await registerRaidPermissionsPage(app, webAssets);
await registerRaidPage(app, webAssets);
await registerRafflePage(app, webAssets);
await registerRaffleEntryPage(app, webAssets);
await registerRaffleClaimsPage(app, webAssets);
await registerRaffleHistoryPage(app, webAssets);
await registerRaffleRulesPage(app, webAssets);
await registerRaffleRoundPage(app, webAssets);
await registerRaffleAdminPage(app, webAssets);

await registerAuthRoutes(app);
await registerGuildRoutes(app);
await registerRaffleRoutes(app);
await registerApiV1Routes(app);
await registerRaffleApiV1Routes(app);

let stopGuildRefreshScheduler: (() => void) | null = null;

const shutdown = async (): Promise<void> => {
  stopGuildRefreshScheduler?.();
  await app.close();
  await pool.end();
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: config.port });
stopGuildRefreshScheduler = startGuildRefreshScheduler(app.log);
