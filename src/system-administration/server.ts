import Fastify from "fastify";
import { administrationStatus } from "./operations.js";
import { AdministrationSessions } from "./sessions.js";
import { readDatabaseConfiguration, publicDatabaseConfiguration } from "./database-configuration.js";

const COOKIE_NAME = "go_admin_session";

function sessionCookie(token: string, maxAge: number): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/administration; Max-Age=${maxAge}`;
}

function readSessionCookie(header: string | undefined): string | null {
  const pair = header?.split(";").map(part => part.trim()).find(part => part.startsWith(COOKIE_NAME + "="));
  return pair ? pair.slice(COOKIE_NAME.length + 1) : null;
}

export function createAdministrationServer(directory?: string) {
  const app = Fastify({ logger: true });
  const sessions = new AdministrationSessions(directory);

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/status", async () => {
    const state = await administrationStatus(directory);
    return { status: state.status, initialized: state.initialized };
  });

  // Only loopback access is supported; session exchange requires the host bootstrap credential.
  app.post("/administration/session", async (request, reply) => {
    const credential = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.authorization || "")?.[1];
    const token = await sessions.create(credential);
    if (!token) return reply.code(401).send({ error: "Unauthorized" });
    return reply.header("Set-Cookie", sessionCookie(token, 900)).header("Cache-Control", "no-store").send({ authenticated: true });
  });

  app.get("/administration/installation", async (request, reply) => {
    if (!(await sessions.valid(readSessionCookie(request.headers.cookie)))) return reply.code(401).send({ error: "Unauthorized" });
    return reply.header("Cache-Control", "no-store").send(await administrationStatus(directory));
  });

  app.get("/administration/database", async (request, reply) => {
    if (!(await sessions.valid(readSessionCookie(request.headers.cookie)))) return reply.code(401).send({ error: "Unauthorized" });
    return reply.header("Cache-Control", "no-store").send(publicDatabaseConfiguration(await readDatabaseConfiguration(directory)));
  });

  app.post("/administration/logout", async (request, reply) => {
    // A non-simple header prevents cross-site forms from initiating logout.
    if (request.headers["x-go-admin-action"] !== "logout") return reply.code(403).send({ error: "Forbidden" });
    const token = readSessionCookie(request.headers.cookie);
    if (!(await sessions.valid(token))) return reply.code(401).send({ error: "Unauthorized" });
    sessions.revoke(token);
    return reply.header("Set-Cookie", sessionCookie("", 0)).header("Cache-Control", "no-store").send({ authenticated: false });
  });
  return app;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const app = createAdministrationServer();
  const port = Number(process.env.GUILD_OPERATIONS_ADMIN_PORT || "3103");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid administration port");
  // Container networking requires an internal wildcard bind; publish only to host loopback.
  const host = process.env.GUILD_OPERATIONS_ADMIN_BIND_HOST || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "0.0.0.0") throw new Error("Invalid administration bind host");
  await app.listen({ host, port });
}
