import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";

/**
 * Opt-in database integration test. Uses only transaction-scoped advisory
 * locks and does not mutate installation data.
 * RUN_PG_LOCK_TEST=1 DATABASE_URL=... npm test
 */
test("rebind exclusive lock waits for active Discord delivery and blocks new delivery", {
  skip: process.env.RUN_PG_LOCK_TEST !== "1" ? "Requires an explicitly configured PostgreSQL test database" : false,
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL is required for the opt-in integration test");
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000 });
  const delivery = await pool.connect();
  const rebinding = await pool.connect();
  const followingDelivery = await pool.connect();
  try {
    await delivery.query("BEGIN");
    await rebinding.query("BEGIN");
    await followingDelivery.query("BEGIN");
    await delivery.query("SELECT pg_advisory_xact_lock_shared(256, 1)");
    // PostgreSQL lock_timeout establishes that the exclusive lock cannot
    // complete while the shared delivery lock remains held.
    await rebinding.query("SET LOCAL lock_timeout = '100ms'");
    await assert.rejects(rebinding.query("SELECT pg_advisory_xact_lock(256, 1)"), (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "55P03");
    await rebinding.query("ROLLBACK");
    await delivery.query("COMMIT");

    await rebinding.query("BEGIN");
    await rebinding.query("SELECT pg_advisory_xact_lock(256, 1)");
    await followingDelivery.query("SET LOCAL lock_timeout = '100ms'");
    await assert.rejects(followingDelivery.query("SELECT pg_advisory_xact_lock_shared(256, 1)"), (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "55P03");
    await followingDelivery.query("ROLLBACK");
    await rebinding.query("COMMIT");

    await followingDelivery.query("BEGIN");
    await followingDelivery.query("SELECT pg_advisory_xact_lock_shared(256, 1)");
    await followingDelivery.query("COMMIT");
  } finally {
    for (const client of [delivery, rebinding, followingDelivery]) {
      try { await client.query("ROLLBACK"); } catch { /* connection may be aborted */ }
      client.release();
    }
    await pool.end();
  }
});
