import { readdir, readFile } from "node:fs/promises";

export type ActivityPluginMigration = {
  activityKind: string;
  migrationFile: string;
  sql: string;
};

export async function installedActivityPluginMigrations(): Promise<ActivityPluginMigration[]> {
  const activitiesDirectory = new URL("../../activities/", import.meta.url);
  let activities;
  try {
    activities = await readdir(activitiesDirectory, { withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") return [];
    throw error;
  }

  const migrations: ActivityPluginMigration[] = [];
  for (const activity of activities.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const migrationsDirectory = new URL(`../../activities/${activity.name}/migrations/`, import.meta.url);
    let files;
    try {
      files = await readdir(migrationsDirectory, { withFileTypes: true });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code === "ENOENT") continue;
      throw error;
    }

    for (const file of files.filter((entry) => entry.isFile() && /^\d{3}_.+\.sql$/.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name))) {
      migrations.push({
        activityKind: activity.name,
        migrationFile: file.name,
        sql: await readFile(new URL(file.name, migrationsDirectory), "utf8"),
      });
    }
  }

  return migrations;
}
