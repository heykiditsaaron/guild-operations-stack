import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import { activityRegistrationState } from "./core/activity/registry.js";
import type { AssetRegistry } from "./web/assets.js";

export type InstalledActivityPlugin = {
  kind: string;
  register(): void;
  registerRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void>;
};

type ActivityPluginModule = { activityPlugin: InstalledActivityPlugin };

const installedActivityPluginModules = [
  "./modules/raid/plugin.js",
  "./modules/raffle/plugin.js",
] as const;

async function loadActivityPlugin(modulePath: string, logger: FastifyBaseLogger): Promise<InstalledActivityPlugin | null> {
  try {
    const loaded = await import(modulePath) as ActivityPluginModule;
    if (!loaded.activityPlugin) throw new Error(`Activity plugin module ${modulePath} did not export activityPlugin`);
    return loaded.activityPlugin;
  } catch (error) {
    logger.warn({ err: error, modulePath }, "Activity plugin is unavailable");
    return null;
  }
}

export async function registerInstalledActivityPlugins(
  app: FastifyInstance,
  assets: AssetRegistry,
  logger: FastifyBaseLogger,
): Promise<void> {
  for (const modulePath of installedActivityPluginModules) {
    const plugin = await loadActivityPlugin(modulePath, logger);
    if (!plugin) continue;

    plugin.register();

    await app.register(async (activityApp) => {
      activityApp.addHook("preHandler", async (_request, reply) => {
        const state = await activityRegistrationState(plugin.kind);
        if (state?.active) return;
        return reply.code(404).send({ error: "activity_inactive", activity: plugin.kind });
      });
      await plugin.registerRoutes(activityApp, assets);
    });
  }
}
