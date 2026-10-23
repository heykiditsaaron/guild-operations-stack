import { argv, stdout, stderr } from "node:process";
import { administrationStatus, initializeAdministration } from "./operations.js";
import { establishAdministratorCredential, rotateAdministratorCredential } from "./authorization.js";
import { readDatabaseConfiguration, publicDatabaseConfiguration, writeDatabaseConfiguration } from "./database-configuration.js";
import { readFile } from "node:fs/promises";
import { deploymentReadiness } from "./deployment-readiness.js";

async function main(): Promise<void> {
  const command = argv[2] || "help";
  if (command === "help") {
    stdout.write("System Administration (foundation)\nCommands: help, status, initialize, enroll-administrator, rotate-administrator, database-status, database-configure <json-file>, deployment-check\n");
  } else if (command === "status") {
    stdout.write(JSON.stringify(await administrationStatus(), null, 2) + "\n");
  } else if (command === "initialize") {
    stdout.write(JSON.stringify(await initializeAdministration(), null, 2) + "\n");
  } else if (command === "enroll-administrator") {
    stdout.write((await establishAdministratorCredential()) + "\n");
  } else if (command === "rotate-administrator") {
    stdout.write((await rotateAdministratorCredential()) + "\n");
  } else if (command === "deployment-check") {
    const result = await deploymentReadiness();
    stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!result.ready) process.exitCode = 1;
  } else if (command === "database-status") {
    stdout.write(JSON.stringify(publicDatabaseConfiguration(await readDatabaseConfiguration()), null, 2) + "\n");
  } else if (command === "database-configure") {
    if (!argv[3]) throw new Error("Usage: database-configure <json-file>");
    await writeDatabaseConfiguration(JSON.parse(await readFile(argv[3], "utf8")));
    stdout.write("Database configuration saved; running services are unchanged.\n");
  } else {
    stderr.write(`Unknown command: ${command}\n`);
    process.exitCode = 2;
  }
}
main().catch((error: unknown) => {
  stderr.write(`System Administration: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
