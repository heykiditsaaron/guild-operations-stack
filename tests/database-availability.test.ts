import assert from "node:assert/strict";
import { test } from "node:test";
import { isDatabaseUnavailable } from "../src/core/operations/database-availability.ts";

test("classifies PostgreSQL connection failures as database unavailability", () => {
  for (const code of ["08006", "08001", "57P01", "57P02", "57P03", "53300", "ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"]) {
    assert.equal(isDatabaseUnavailable({ code }), true, code);
  }
  assert.equal(isDatabaseUnavailable(new Error("Connection terminated unexpectedly")), true);
  assert.equal(isDatabaseUnavailable(new Error("timeout exceeded when trying to connect")), true);
});

test("does not classify ordinary query or application failures as a database outage", () => {
  for (const code of ["23505", "23503", "42P01", "42601", "22001", "P0001"]) {
    assert.equal(isDatabaseUnavailable({ code }), false, code);
  }
  assert.equal(isDatabaseUnavailable(new Error("application operation failed")), false);
  assert.equal(isDatabaseUnavailable(null), false);
});
