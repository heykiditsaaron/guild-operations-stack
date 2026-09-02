import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db.js";
import { registerAuthRoutes } from "./auth.js";
import { registerMainSelectionPage } from "./main-selection-page.js";
import { loadAssetRegistry, registerAssetRoutes } from "./web/assets.js";
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

await registerAuthRoutes(app);
await registerMainSelectionPage(app);

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: config.port });
