import assert from "node:assert/strict";
import { test } from "node:test";
import { publishInspectionBestEffort } from "../src/core/operational-inspection/best-effort.ts";

test("successful diagnostic publication does not call failure handlers", async () => {
  let failures = 0;
  await publishInspectionBestEffort(async () => undefined, () => { failures++; }, () => { failures++; });
  assert.equal(failures, 0);
});

test("failed diagnostic publication does not reject and reports original failure", async () => {
  const failure = new Error("inspection database unavailable");
  let observed: unknown;
  await publishInspectionBestEffort(
    async () => { throw failure; },
    (error) => { observed = error; },
    () => { throw new Error("unexpected reporter failure"); },
  );
  assert.equal(observed, failure);
});

test("throwing failure reporter is isolated and observed", async () => {
  const reportingError = new Error("reporter failed");
  let observed: unknown;
  await publishInspectionBestEffort(
    async () => { throw new Error("insert failed"); },
    () => { throw reportingError; },
    (error) => { observed = error; },
  );
  assert.equal(observed, reportingError);
});

test("failure in fallback reporter cannot escape the diagnostic boundary", async () => {
  await assert.doesNotReject(publishInspectionBestEffort(
    async () => { throw new Error("insert failed"); },
    () => { throw new Error("reporter failed"); },
    () => { throw new Error("fallback failed"); },
  ));
});
