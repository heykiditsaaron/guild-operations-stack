import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const sourceActivities = new URL("../src/activities/", import.meta.url);

await rm(dist, { recursive: true, force: true });

export async function copyActivityMigrationAssets() {
  let activityPlugins;
  try {
    activityPlugins = await readdir(sourceActivities, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }

  for (const activityPlugin of activityPlugins.filter((entry) => entry.isDirectory())) {
    const sourceMigrations = new URL(`../src/activities/${activityPlugin.name}/migrations/`, import.meta.url);
    let migrations;
    try {
      migrations = await readdir(sourceMigrations, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }

    for (const migration of migrations.filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))) {
      const destination = join(new URL(`../dist/activities/${activityPlugin.name}/migrations/`, import.meta.url).pathname, migration.name);
      await mkdir(dirname(destination), { recursive: true });
      await cp(new URL(migration.name, sourceMigrations), destination);
    }
  }
}

await copyActivityMigrationAssets();
