import cookie from "@fastify/cookie";
import Fastify, { type FastifyBaseLogger } from "fastify";
import { componentLogger } from "./core/runtime-logger.js";
import { registerApiV1Routes } from "./api-v1-routes.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { registerAuthRoutes } from "./auth.js";
import { registerGlobalGuildCapabilityDefinitions, registerGuildCapabilityPolicyObserver } from "./core/authority/guild-capability-policy.js";
import { registerGuildRoutes } from "./guild-routes.js";
import { installationSecretKey } from "./core/installation-secret.js";
import { installationOperational } from "./core/installation/guild-binding.js";
import { installationBlizzardEncryptedSecretExists } from "./core/installation/blizzard-configuration.js";
import { registerInstallationRoutes } from "./core/installation/routes.js";
import { discordEncryptedSecretsExist } from "./integrations/discord/configuration.js";
import { registerDiscordOAuthRoutes } from "./integrations/discord/oauth-routes.js";
import { registerDiscordInteractionRoutes } from "./integrations/discord/interaction-routes.js";
import { loadDiscordInteractionPublicKey } from "./integrations/discord/interaction-key.js";
import { registerApplicationEmissionConsumers } from "./emissions/consumers.js";
import { startEmissionRecovery } from "./emissions/recovery.js";
import { startGuildRefreshScheduler } from "./guild-refresh-scheduler.js";
import { registerInstalledActivityPlugins } from "./activity-plugins.js";
import { loadAssetRegistry, registerAssetRoutes } from "./web/assets.js";
import { registerAdminPage } from "./web/pages/admin.js";
import { registerDiscordAdminPage } from "./web/pages/discord-admin.js";
import { registerOperationsAdminPage } from "./web/pages/operations.js";
import { registerCalendarPage } from "./web/pages/calendar.js";
import { registerActivitiesPage } from "./web/pages/activities.js";
import { registerArticlesPage } from "./web/pages/articles.js";
import { registerActivityBoundaryRoutes } from "./web/pages/activity-boundary.js";
import { registerHomePage } from "./web/pages/home.js";
import { registerMePage } from "./web/pages/me.js";
import { registerMyParticipationPage } from "./web/pages/my-participation.js";
import { registerSiteInformationPages } from "./web/pages/site-information.js";
import { registerSetupPage } from "./web/pages/setup.js";

installationSecretKey({ encryptedDataExists: await installationBlizzardEncryptedSecretExists() || await discordEncryptedSecretsExist() });

const apiLogger: FastifyBaseLogger = componentLogger("api");
const app = Fastify({ loggerInstance: apiLogger, disableRequestLogging: true });
await app.register(cookie);

registerGlobalGuildCapabilityDefinitions();

const webAssets = await loadAssetRegistry();
await registerInstalledActivityPlugins(app, webAssets, app.log);

registerApplicationEmissionConsumers();
registerGuildCapabilityPolicyObserver();

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

await registerAssetRoutes(app, webAssets);
await registerHomePage(app, webAssets);
await registerMePage(app, webAssets);
await registerMyParticipationPage(app, webAssets);
await registerSiteInformationPages(app, webAssets);
await registerCalendarPage(app, webAssets);
await registerActivitiesPage(app, webAssets);
await registerArticlesPage(app, webAssets);
await registerActivityBoundaryRoutes(app, webAssets);
app.get("/events", async (_request, reply) => reply.redirect("/activities"));
app.get<{ Params: { "*": string } }>("/events/*", async (request, reply) => reply.redirect(`/activities/${request.params["*"]}`));
await registerAdminPage(app, webAssets);
await registerDiscordAdminPage(app, webAssets);
await registerDiscordOAuthRoutes(app);
await loadDiscordInteractionPublicKey();
await registerDiscordInteractionRoutes(app);
await registerOperationsAdminPage(app, webAssets);
await registerAuthRoutes(app, webAssets);

let stopGuildRefreshScheduler: (() => void) | null = null;
let stopEmissionRecovery: (() => void) | null = null;
const startOperationalBackgroundWork = (): void => {
  if (stopEmissionRecovery || stopGuildRefreshScheduler) return;
  stopEmissionRecovery = startEmissionRecovery(app.log);
  stopGuildRefreshScheduler = startGuildRefreshScheduler(app.log);
};

await registerSetupPage(app, webAssets);
await registerInstallationRoutes(app, { onOperational: startOperationalBackgroundWork });
await registerGuildRoutes(app);
await registerApiV1Routes(app);

const shutdown = async (): Promise<void> => {
  stopEmissionRecovery?.();
  stopGuildRefreshScheduler?.();
  await app.close();
  await pool.end();
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: config.port });

if (await installationOperational()) {
  startOperationalBackgroundWork();
} else {
  app.log.info("Installation is not operational; background guild work is paused");
}
