import { argv, stdout, stderr } from "node:process";
import { administrationStatus, initializeAdministration } from "./operations.js";
import { establishAdministratorCredential } from "./authorization.js";

async function main(): Promise<void> {
  const command = argv[2] || "help";
  if (command === "help") {
    stdout.write("System Administration (foundation)\nCommands: help, status, initialize, enroll-administrator\n");
  } else if (command === "status") {
    stdout.write(JSON.stringify(await administrationStatus(), null, 2) + "\n");
  } else if (command === "initialize") {
    stdout.write(JSON.stringify(await initializeAdministration(), null, 2) + "\n");
  } else if (command === "enroll-administrator") {
    stdout.write((await establishAdministratorCredential()) + "\n");
  } else {
    stderr.write(`Unknown command: ${command}\n`);
    process.exitCode = 2;
  }
}
main().catch((error: unknown) => {
  stderr.write(`System Administration: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
