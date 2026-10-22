/** Host Tools: deployment administration, never guild operations. */
import { argv, exitCode, stdout, stderr } from "node:process";

const usage = `Guild Operations — Host Tools

Usage: ./go <command>

Commands:
  help       Show this help
  version    Show the installed application version

Host Tools administer the installation, not guild activities or permissions.
Additional installation and recovery commands will be added as their
application operations are made available to the CLI.
`;

async function main(args: string[]): Promise<void> {
  const command = args[0] ?? "help";
  if ((command === "help" || command === "--help" || command === "-h") && args.length <= 1) {
    stdout.write(usage);
    return;
  }
  if (command === "version" && args.length === 1) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { resolve, dirname } = await import("node:path");
    const location = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(await readFile(resolve(location, "../package.json"), "utf8")) as { version: string };
    stdout.write(`Guild Operations ${packageJson.version}\n`);
    return;
  }
  stderr.write(`Unknown Host Tools command: ${args.join(" ")}\n\n${usage}`);
  process.exitCode = 2;
}

main(argv.slice(2)).catch((error: unknown) => {
  stderr.write(`Host Tools failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
