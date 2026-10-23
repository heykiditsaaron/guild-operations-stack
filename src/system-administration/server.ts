import Fastify from "fastify";
import { administrationStatus } from "./operations.js";
import { validAdministratorCredential } from "./authorization.js";

export function createAdministrationServer(directory?: string) {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok" }));
  // Installation identifiers and state are not exposed over unauthenticated HTTP.
  app.get("/status", async () => {
    const state = await administrationStatus();
    return { status: state.status, initialized: state.initialized };
  });
  app.get("/administration/installation", async (request, reply) => {
    const match = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.authorization || "");
    if (!match || !(await validAdministratorCredential(match[1], directory))) return reply.code(401).send({ error: "Unauthorized" });
    return administrationStatus(directory);
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
