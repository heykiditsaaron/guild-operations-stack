import type { InstalledActivityPlugin } from "../../activity-plugins.js";
import { registerRaffleActivityIntegration } from "./activity.js";
import { registerRaffleApiV1Routes } from "./api-v1-routes.js";
import { registerRaffleRoutes } from "./routes.js";
import { registerRaffleClaimsPage } from "./web/claims.js";
import { registerRaffleEntryPage } from "./web/enter.js";
import { registerRaffleHistoryPage } from "./web/history.js";
import { registerRafflePage } from "./web/index.js";
import { registerRaffleOperationPage } from "./web/operation.js";
import { registerRaffleRecordPage } from "./web/record.js";
import { registerRaffleRulesPage } from "./web/rules.js";

export const activityPlugin: InstalledActivityPlugin = {
  kind: "raffle", label: "Raffle",
  register() { registerRaffleActivityIntegration(); },
  async registerRoutes(app, assets) {
    await registerRafflePage(app, assets); await registerRaffleEntryPage(app, assets);
    await registerRaffleClaimsPage(app, assets); await registerRaffleHistoryPage(app, assets);
    await registerRaffleRulesPage(app, assets); await registerRaffleRecordPage(app, assets);
    await registerRaffleOperationPage(app, assets); await registerRaffleRoutes(app); await registerRaffleApiV1Routes(app);
  },
};
