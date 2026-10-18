import type { InstalledActivityPlugin } from "../../activity-plugins.js";
import { registerRaidActivityIntegration } from "./activity.js";
import { registerDiscordRaidEmissionConsumer } from "./discord-projection.js";
import { registerDiscordRaidInteractionHandler } from "./discord-interactions.js";
import { registerRaidOperationDetailPage } from "./web/detail.js";
import { registerRaidDefinitionPage } from "./web/definition.js";
import { registerRaidParticipationRoutes } from "./web/index.js";
import { registerRaidOperationPage } from "./web/operation.js";

export const activityPlugin: InstalledActivityPlugin = {
  kind: "raid", label: "Raid",
  register() { registerRaidActivityIntegration(); registerDiscordRaidEmissionConsumer(); registerDiscordRaidInteractionHandler(); },
  async registerRoutes(app, assets) {
    await registerRaidOperationPage(app, assets);
    await registerRaidOperationDetailPage(app, assets);
    await registerRaidDefinitionPage(app, assets);
    await registerRaidParticipationRoutes(app, assets);
  },
};
