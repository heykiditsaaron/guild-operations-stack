import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installationBlizzardConfiguration } from "../src/core/installation/blizzard-configuration.js";

test("Blizzard credential files override direct environment values", async () => {
  const directory = mkdtempSync(join(tmpdir(), "go-blizzard-"));
  try {
    const file = join(directory, "secret");
    writeFileSync(file, "file-secret\n");
    const env = { BLIZZARD_CLIENT_ID: "id", BLIZZARD_CLIENT_SECRET: "env-secret", BLIZZARD_CLIENT_SECRET_FILE: file };
    assert.deepEqual(await installationBlizzardConfiguration(env), { clientId: "id", clientSecret: "file-secret" });
    await assert.rejects(installationBlizzardConfiguration({ ...env, BLIZZARD_CLIENT_SECRET_FILE: join(directory, "missing") }), /ENOENT/);
    writeFileSync(file, "");
    await assert.rejects(installationBlizzardConfiguration(env), /empty/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
