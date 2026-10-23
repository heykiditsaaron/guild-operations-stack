import Fastify from "fastify";
import { administrationStatus } from "./operations.js";

export function createAdministrationServer() {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok" }));
  // Installation identifiers and state are not exposed over unauthenticated HTTP.
  app.get("/status", async () => {
    const state = await administrationStatus();
    return { status: state.status, initialized: state.initialized };
  });
  return app;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const app = createAdministrationServer();
  const port = Number(process.env.GUILD_OPERATIONS_ADMIN_PORT || "3103");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid administration port");
  // Local-only until independent administrative authentication is implemented.
  await app.listen({ host: "127.0.0.1", port });
}
