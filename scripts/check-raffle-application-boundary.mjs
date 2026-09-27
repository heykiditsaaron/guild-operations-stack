import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve("src");
const applicationPath = "activities/raffle/application.ts";
const mutationNames = [
  "establishRaffle",
  "modifyRaffle",
  "openRaffleParticipation",
  "pauseRaffleParticipation",
  "resumeRaffleParticipation",
  "cancelRaffle",
  "establishRaffleClaim",
  "revokeRaffleClaim",
  "approveRaffleClaim",
  "denyRaffleClaim",
  "drawRaffle",
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extname(entry.name) === ".ts" ? [path] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const path of await sourceFiles(root)) {
  const projectPath = relative(root, path).replaceAll("\\", "/");
  if (projectPath === applicationPath) continue;

  const source = await readFile(path, "utf8");
  const imports = source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']*activities\/raffle\/domain\.js|\.\/domain\.js)["'];?/g);
  for (const match of imports) {
    const imported = match[1]
      .split(",")
      .map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0])
      .filter(Boolean);
    const forbidden = imported.filter((name) => mutationNames.includes(name));
    if (forbidden.length) violations.push(`${projectPath}: ${forbidden.join(", ")}`);
  }
}

if (violations.length) {
  console.error("Raffle authoritative mutations must enter through src/activities/raffle/application.ts.");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Raffle application boundary is intact.");
