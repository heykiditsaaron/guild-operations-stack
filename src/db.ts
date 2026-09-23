import { Pool, type PoolClient } from "pg";
const PACKAGED_DATABASE_URL = "postgres://guild_operations:guild_operations@db:5432/guild_operations";

export const pool = new Pool({ connectionString: PACKAGED_DATABASE_URL });

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
