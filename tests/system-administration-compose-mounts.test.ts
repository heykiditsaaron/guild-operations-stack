import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

test("application services mount the Administration store read-only", async () => {
  const compose = await readFile(new URL("../compose.yaml", import.meta.url), "utf8");
  for (const name of ["migrate", "api", "discord"]) {
    const section = compose.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z]+:|^volumes:|$(?![\\s\\S]))`, "m"));
    assert.ok(section, `Missing service ${name}`);
    assert.match(section[1], /\/var\/lib\/guild-operations-administration:\/var\/lib\/guild-operations-administration:ro/);
  }
});
