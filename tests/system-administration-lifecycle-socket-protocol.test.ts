import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeLifecycleMessage, encodeLifecycleMessage, MAX_LIFECYCLE_MESSAGE_BYTES } from "../src/system-administration/lifecycle-socket-protocol.js";

test("Unix socket lifecycle message round trips supported operations", () => {
  for (const action of ["apply", "start"] as const) {
    const request = { schemaVersion: 1, action };
    assert.deepEqual(decodeLifecycleMessage(encodeLifecycleMessage(request)), request);
  }
});

test("Unix socket lifecycle protocol refuses command injection and invalid framing", () => {
  for (const value of [
    { schemaVersion: 1, action: "stop" },
    { schemaVersion: 1, action: "apply", executable: "sh" },
    { schemaVersion: 1, action: "apply", composeDirectory: "/tmp" },
  ]) {
    assert.throws(() => encodeLifecycleMessage(value), /Unsupported|Unexpected/);
  }
  for (const bytes of [
    Buffer.from('{"schemaVersion":1,"action":"apply"}'),
    Buffer.from('{"schemaVersion":1,"action":"apply"}\n{}\n'),
    Buffer.alloc(MAX_LIFECYCLE_MESSAGE_BYTES + 1, 65),
    Buffer.from('not json\n'),
  ]) {
    assert.throws(() => decodeLifecycleMessage(bytes), /Invalid/);
  }
});
