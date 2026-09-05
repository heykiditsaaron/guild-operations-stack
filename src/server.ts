import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db.js";
import { registerAuthRoutes } from "./auth.js";
import { registerDiscordRoutes } from "./discord.js";
import { registerEventQueryRoutes } from "./events/query-routes.js";
import { registerGuildRoutes } from "./guild-routes.js";
import { registerRaffleQueryRoutes } from "./raffle/query-routes.js";
import { registerRaffleRoutes } from "./raffle/routes.js";
import { loadAssetRegistry, registerAssetRoutes } from "./web/assets.js";
import { registerAdminPage } from "./web/pages/admin.js";
import { registerEventsPage } from "./web/pages/events/index.js";
import { registerRaffleAdminPage } from "./web/pages/events/raffle/admin.js";
import { registerRaffleClaimsPage } from "./web/pages/events/raffle/claims.js";
import { registerRaffleEntryPage } from "./web/pages/events/raffle/enter.js";
import { registerRaffleHistoryPage } from "./web/pages/events/raffle/history.js";
import { registerRafflePage } from "./web/pages/events/raffle/index.js";
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
await registerRaffleAdminPage(app, webAssets);

await registerAuthRoutes(app);
await registerDiscordRoutes(app);
await registerGuildRoutes(app);
await registerRaffleRoutes(app);
await registerRaffleQueryRoutes(app);
await registerEventQueryRoutes(app);

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: config.port });
