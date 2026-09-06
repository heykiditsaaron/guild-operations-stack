import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db.js";
import { registerAuthRoutes } from "./auth.js";
import { registerDiscordRoutes } from "./discord.js";
import { registerGuildRoutes } from "./guild-routes.js";
import { registerRaffleGuildEventOffering } from "./modules/raffle/offering.js";
import { registerRaffleQueryRoutes } from "./modules/raffle/query-routes.js";
import { registerRaffleRoutes } from "./modules/raffle/routes.js";
import { registerQueryRoutes } from "./query-routes.js";
import { loadAssetRegistry, registerAssetRoutes } from "./web/assets.js";
import { registerAdminPage } from "./web/pages/admin.js";
import { registerEventsPage } from "./web/pages/events/index.js";
import { registerRaffleAdminPage } from "./web/pages/events/raffle/admin.js";
import { registerRaffleClaimsPage } from "./web/pages/events/raffle/claims.js";
import { registerRaffleEntryPage } from "./web/pages/events/raffle/enter.js";
import { registerRaffleHistoryPage } from "./web/pages/events/raffle/history.js";
import { registerRafflePage } from "./web/pages/events/raffle/index.js";
import { registerRaffleRoundPage } from "./web/pages/events/raffle/round.js";
import { registerRaffleRulesPage } from "./web/pages/events/raffle/rules.js";
import { registerHomePage } from "./web/pages/home.js";

const app = Fastify({
  logger: true,
  // OAuth callbacks carry short-lived authorization codes and state in the
  // query string. Keep framework request logging disabled so those values are
  // never written to routine application logs.
  disableRequestLogging: true,
});
await app.register(cookie);
registerRaffleGuildEventOffering();

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

const webAssets = await loadAssetRegistry();
await registerAssetRoutes(app, webAssets);
await registerHomePage(app, webAssets);
await registerEventsPage(app, webAssets);
await registerAdminPage(app, webAssets);
await registerRafflePage(app, webAssets);
await registerRaffleEntryPage(app, webAssets);
await registerRaffleClaimsPage(app, webAssets);
await registerRaffleHistoryPage(app, webAssets);
await registerRaffleRulesPage(app, webAssets);
await registerRaffleRoundPage(app, webAssets);
await registerRaffleAdminPage(app, webAssets);

await registerAuthRoutes(app);
await registerDiscordRoutes(app);
await registerGuildRoutes(app);
await registerRaffleRoutes(app);
await registerRaffleQueryRoutes(app);
await registerQueryRoutes(app);

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: config.port });
