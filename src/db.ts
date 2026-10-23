import { Pool, type PoolClient } from "pg";
import { componentLogger } from "./core/runtime-logger.js";
import { config } from "./config.js";
export const pool = new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000 });

// Idle PostgreSQL connections emit errors outside request/transaction promises.
pool.on("error", (error) => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
  componentLogger("database").warn({ code, message: error instanceof Error ? error.message : "Unknown database connection error" }, "PostgreSQL idle connection error");
});

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // A lost connection must not mask the original transaction failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
