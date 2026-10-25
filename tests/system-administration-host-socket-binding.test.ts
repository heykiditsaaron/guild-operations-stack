import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:net";
import { chmod, lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindHostLifecycleSocket } from "../src/system-administration/host-socket-binding.js";

test("executor socket binding restricts permissions and refuses existing paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-executor-bind-"));
  const socketPath = join(directory, "executor.sock");
  const server = createServer();
  try {
    await chmod(directory, 0o700);
    await bindHostLifecycleSocket(server, socketPath);
    const stat = await lstat(socketPath);
    assert.equal(stat.isSocket(), true);
    assert.equal(stat.mode & 0o777, 0o660);
    await assert.rejects(bindHostLifecycleSocket(createServer(), socketPath), /already exists/);
  } finally {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("executor socket binding rejects public directories and occupied files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-executor-public-"));
  const socketPath = join(directory, "executor.sock");
  try {
    await chmod(directory, 0o777);
    await assert.rejects(bindHostLifecycleSocket(createServer(), socketPath), /deny access/);
    await chmod(directory, 0o700);
    await writeFile(socketPath, "occupied");
    await assert.rejects(bindHostLifecycleSocket(createServer(), socketPath), /already exists/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
