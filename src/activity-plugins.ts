import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import { activityAdministration, activityRegistrationState, configureActivityActivation, markActivityActivationFailed } from "./core/activity/registry.js";
import { rememberActivityCapabilityDeclarations } from "./core/activity/plugin-administration.js";
import { rememberActivityPlugin } from "./core/activity/plugin-control.js";
import { activityPluginEnabled } from "./core/activity/plugin-enablement.js";
import type { AssetRegistry } from "./web/assets.js";

export type InstalledActivityPlugin = {
  kind: string;
  label: string;
  version?: string;
  register(): void;
  registerRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void>;
};

type ActivityPluginModule = { activityPlugin: InstalledActivityPlugin };

const failedActivityPlugins = new Map<string, Error>();
const availableActivityPlugins = new Set<string>();

export type ActivityRuntimeState = "available" | "failed";

export function activityPluginRuntimeState(activityKind: string): ActivityRuntimeState | null {
  if (failedActivityPlugins.has(activityKind)) return "failed";
  return availableActivityPlugins.has(activityKind) ? "available" : null;
}

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
    availableActivityPlugins.add(plugin.kind);

    try {
      failedActivityPlugins.delete(plugin.kind);
      plugin.register();
      await rememberActivityPlugin({ kind: plugin.kind, label: plugin.label, version: plugin.version });
      const administration = await activityAdministration(plugin.kind);
      await rememberActivityCapabilityDeclarations(plugin.kind, administration?.capabilities ?? []);
      configureActivityActivation(plugin.kind, { enabled: () => activityPluginEnabled(plugin.kind) });
    } catch (error) {
      failedActivityPlugins.set(plugin.kind, error instanceof Error ? error : new Error(String(error)));
      markActivityActivationFailed(plugin.kind);
      logger.warn({ err: error, activityKind: plugin.kind }, "Activity plugin failed to activate");
      continue;
    }

    const state = await activityRegistrationState(plugin.kind);
    if (state?.active) {
      await app.register(async (activityApp) => {
        await plugin.registerRoutes(activityApp, assets);
      });
    }
  }
}
