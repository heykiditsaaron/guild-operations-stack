import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { establishAdministratorCredential, readAdministratorCredential, validAdministratorCredential } from "../src/system-administration/authorization.js";
import { createAdministrationServer } from "../src/system-administration/server.js";

test("host enrollment is one-time and stores only a digest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-auth-"));
  try {
    assert.equal(await readAdministratorCredential(directory), null);
    const token = await establishAdministratorCredential(directory);
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(await validAdministratorCredential(token, directory), true);
    assert.equal(await validAdministratorCredential("a".repeat(64), directory), false);
    assert.equal(await validAdministratorCredential("not-a-token", directory), false);
    assert.equal((await readFile(join(directory, "administrator-credential.sha256"), "utf8")).includes(token), false);
    await assert.rejects(() => establishAdministratorCredential(directory), /already established/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("private installation state requires independent authorization", async () => {
  const directory = await mkdtemp(join(tmpdir(), "go-auth-"));
  const app = createAdministrationServer(directory);
  try {
    assert.equal((await app.inject("/administration/installation")).statusCode, 401);
    const token = await establishAdministratorCredential(directory);
    assert.equal((await app.inject({url:"/administration/installation",headers:{authorization:"Bearer invalid"}})).statusCode, 401);
    const response = await app.inject({url:"/administration/installation",headers:{authorization:`Bearer ${token}`}});
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().initialized, false);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
