import type { InstalledActivityPlugin } from "../../activity-plugins.js";
import { registerRaffleActivityIntegration } from "./activity.js";
import { registerRaffleGuildActivityOffering } from "./offering.js";
import { registerRaffleCapabilityDefinitions } from "./permissions.js";
import { registerRaffleApiV1Routes } from "./api-v1-routes.js";
import { registerRaffleRoutes } from "./routes.js";
import { registerRaffleClaimsPage } from "../../web/pages/events/raffle/claims.js";
import { registerRaffleEntryPage } from "../../web/pages/events/raffle/enter.js";
import { registerRaffleHistoryPage } from "../../web/pages/events/raffle/history.js";
import { registerRafflePage } from "../../web/pages/events/raffle/index.js";
import { registerRaffleOperationPage } from "../../web/pages/events/raffle/operation.js";
import { registerRaffleRecordPage } from "../../web/pages/events/raffle/record.js";
import { registerRaffleRulesPage } from "../../web/pages/events/raffle/rules.js";

export const activityPlugin: InstalledActivityPlugin = {
  kind: "raffle",
  label: "Raffle",
  register() {
    registerRaffleCapabilityDefinitions();
    registerRaffleActivityIntegration();
    registerRaffleGuildActivityOffering();
  },
  async registerRoutes(app, assets) {
    await registerRafflePage(app, assets);
    await registerRaffleEntryPage(app, assets);
    await registerRaffleClaimsPage(app, assets);
    await registerRaffleHistoryPage(app, assets);
    await registerRaffleRulesPage(app, assets);
    await registerRaffleRecordPage(app, assets);
    await registerRaffleOperationPage(app, assets);
    await registerRaffleRoutes(app);
    await registerRaffleApiV1Routes(app);
  },
};
