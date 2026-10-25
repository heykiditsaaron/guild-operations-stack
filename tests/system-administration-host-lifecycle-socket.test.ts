import assert from "node:assert/strict";
import { test } from "node:test";
import { createConnection } from "node:net";
import { createHostLifecycleSocketServer } from "../src/system-administration/host-lifecycle-socket.js";
import { encodeLifecycleMessage, submitLifecycleRequest } from "../src/system-administration/lifecycle-socket-protocol.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("host socket accepts supported lifecycle requests and rejects malformed requests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-socket-"));
  const path = join(directory, "executor.sock");
  const calls: string[] = [];
  const server = createHostLifecycleSocketServer(async (request) => { calls.push(request.action); });
  try {
    await new Promise<void>((resolve) => server.listen(path, resolve));
    await submitLifecycleRequest(path, { schemaVersion: 1, action: "apply" });
    await submitLifecycleRequest(path, { schemaVersion: 1, action: "start" });
    assert.deepEqual(calls, ["apply", "start"]);
    const response = await new Promise<string>((resolve, reject) => {
      const socket = createConnection(path);
      let value = "";
      socket.on("connect", () => socket.write('{"schemaVersion":1,"action":"stop"}\n'));
      socket.on("data", (chunk) => { value += chunk.toString(); });
      socket.on("end", () => resolve(value));
      socket.on("error", reject);
    });
    assert.equal(response, '{"ok":false}\n');
    assert.deepEqual(calls, ["apply", "start"]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
