import assert from "node:assert/strict";
import { test } from "node:test";
import { assertBundledClusterContinuity } from "../src/system-administration/bundled-cluster-continuity.js";

test("fresh bundled PostgreSQL storage can initialize", () => {
  assert.doesNotThrow(() => assertBundledClusterContinuity({ kind: "absent" }));
  assert.doesNotThrow(() => assertBundledClusterContinuity({ kind: "empty" }));
});

test("existing clusters cannot be silently assigned new credentials", () => {
  assert.throws(
    () => assertBundledClusterContinuity({ kind: "existing", adoptionVerified: false }),
    /requires verified credential adoption/,
  );
  assert.doesNotThrow(() => assertBundledClusterContinuity({ kind: "existing", adoptionVerified: true }));
  assert.throws(
    () => assertBundledClusterContinuity({ kind: "unknown" }),
    /could not be verified/,
  );
});
