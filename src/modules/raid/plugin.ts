import type { InstalledActivityPlugin } from "../../activity-plugins.js";
import { registerRaidActivityIntegration } from "./activity.js";
import { registerRaidCapabilityDefinitions } from "./permissions.js";
import { registerRaidOperationDetailPage } from "../../web/pages/events/raid/detail.js";
import { registerRaidDefinitionPage } from "../../web/pages/events/raid/definition.js";
import { registerRaidPage } from "../../web/pages/events/raid/index.js";
import { registerRaidOperationPage } from "../../web/pages/events/raid/operation.js";

export const activityPlugin: InstalledActivityPlugin = {
  kind: "raid",
  label: "Raid",
  register() {
    registerRaidCapabilityDefinitions();
    registerRaidActivityIntegration();
  },
  async registerRoutes(app, assets) {
    await registerRaidOperationPage(app, assets);
    await registerRaidOperationDetailPage(app, assets);
    await registerRaidDefinitionPage(app, assets);
    await registerRaidPage(app, assets);
  },
};
