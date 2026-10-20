import { readdir } from "node:fs/promises";
import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import { activityAdministration, activityRegistrationState, configureActivityActivation, markActivityActivationFailed } from "./core/activity/registry.js";
import { rememberActivityCapabilityDeclarations } from "./core/activity/plugin-administration.js";
import { rememberActivityPlugin } from "./core/activity/plugin-control.js";
import { activityPluginEnabled } from "./core/activity/plugin-enablement.js";
import type { AssetRegistry } from "./web/assets.js";
import { publishOperationalRecord } from "./operational-inspection.js";

async function publishAvailabilityExceptionBestEffort(
  input: Parameters<typeof publishOperationalRecord>[0],
  logger: FastifyBaseLogger,
): Promise<void> {
  try {
    await publishOperationalRecord(input);
  } catch (error) {
    logger.error({ err: error, activityKind: input.details?.activityKind, stage: input.details?.stage }, "Activity availability inspection publication failed");
  }
}

export type InstalledActivityPlugin = {
  kind: string;
  label: string;
  version?: string;
  register(): void;
  registerDiscordInteractions?(): void;
  registerRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void>;
};

type ActivityPluginModule = { activityPlugin: InstalledActivityPlugin };
type InstalledActivityPluginModule = { kind: string; modulePath: string };

const failedActivityPlugins = new Map<string, Error>();
const availableActivityPlugins = new Set<string>();

export type ActivityRuntimeState = "available" | "failed";

export function activityPluginRuntimeState(activityKind: string): ActivityRuntimeState | null {
  if (failedActivityPlugins.has(activityKind)) return "failed";
  return availableActivityPlugins.has(activityKind) ? "available" : null;
}

async function installedActivityPluginModules(): Promise<InstalledActivityPluginModule[]> {
  const activitiesDirectory = new URL("./activities/", import.meta.url);
  let entries;
  try {
    entries = await readdir(activitiesDirectory, { withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") return [];
    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      kind: entry.name,
      modulePath: `./activities/${entry.name}/plugin.js`,
    }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

async function loadActivityPlugin(
  expectedKind: string,
  modulePath: string,
  logger: FastifyBaseLogger,
): Promise<InstalledActivityPlugin> {
  try {
    const loaded = await import(modulePath) as ActivityPluginModule;
    if (!loaded.activityPlugin) {
      throw new Error(`Activity plugin module ${modulePath} did not export activityPlugin`);
    }
    if (loaded.activityPlugin.kind !== expectedKind) {
      throw new Error(
        `Activity plugin kind ${loaded.activityPlugin.kind} does not match Activity plugin directory ${expectedKind}`,
      );
    }
    return loaded.activityPlugin;
  } catch (error) {
    logger.warn({ err: error, modulePath }, "Activity plugin failed to load");
    throw error;
  }
}

export async function registerInstalledActivityPlugins(
  app: FastifyInstance,
  assets: AssetRegistry,
  logger: FastifyBaseLogger,
): Promise<void> {
  for (const { kind, modulePath } of await installedActivityPluginModules()) {
    let plugin: InstalledActivityPlugin;
    try {
      plugin = await loadActivityPlugin(kind, modulePath, logger);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      failedActivityPlugins.set(kind, failure);
      markActivityActivationFailed(kind);
      await publishAvailabilityExceptionBestEffort({
        source: "activity",
        operation: "availability",
        kind: "exception",
        summary: `Activity plugin ${kind} is physically present but unavailable.`,
        details: { activityKind: kind, stage: "load", error: failure.message },
      }, logger);
      continue;
    }

    availableActivityPlugins.add(plugin.kind);

    try {
      failedActivityPlugins.delete(plugin.kind);
      plugin.register();
      await rememberActivityPlugin({ kind: plugin.kind, label: plugin.label, version: plugin.version });
      const administration = await activityAdministration(plugin.kind);
      await rememberActivityCapabilityDeclarations(plugin.kind, administration?.capabilities ?? []);
      configureActivityActivation(plugin.kind, { enabled: () => activityPluginEnabled(plugin.kind) });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      failedActivityPlugins.set(plugin.kind, failure);
      markActivityActivationFailed(plugin.kind);
      logger.warn({ err: error, activityKind: plugin.kind }, "Activity plugin failed to activate");
      await publishAvailabilityExceptionBestEffort({
        source: "activity",
        operation: "availability",
        kind: "exception",
        summary: `Activity plugin ${plugin.kind} is physically present but unavailable.`,
        details: { activityKind: plugin.kind, stage: "registration", error: failure.message },
      }, logger);
      continue;
    }

    // Registration occurs on each API process start. This is useful runtime
    // diagnostic context, not a new administrative availability transition.
    logger.info(
      { activityKind: plugin.kind, version: plugin.version ?? null },
      "Activity plugin registered and available",
    );

    await app.register(async (activityApp) => {
      activityApp.addHook("onRequest", async (_request, reply) => {
        const state = await activityRegistrationState(plugin.kind);
        if (state?.active) return;
        return reply
          .code(503)
          .header("Cache-Control", "no-cache")
          .send({ error: "activity_unavailable", activityKind: plugin.kind, status: state?.status ?? "unavailable" });
      });
      await plugin.registerRoutes(activityApp, assets);
    });
  }
}
