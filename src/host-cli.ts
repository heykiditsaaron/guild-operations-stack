/** Host Tools administer the deployment, never guild activities. */
import { argv, stdin, stdout, stderr } from "node:process";
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = `Guild Operations — Host Tools

Usage: ./go [command]

  ./go              Open the interactive Host Tools console
  ./go <command>    Execute one command and exit

Commands:
  help       Show this help
  version    Show the installed application version
  exit       Leave the interactive console

Host Tools administer the installation, not guild activities or permissions.
Additional installation and recovery commands will be added as their
application operations become available to the CLI.
`;

/** A single dispatcher serves both the interactive console and direct commands. */
async function dispatch(args: string[], interactive: boolean): Promise<"continue" | "exit" | "invalid"> {
  const command = args[0] ?? "help";
  if (["help", "--help", "-h"].includes(command) && args.length === 1) {
    stdout.write(usage);
    return "continue";
  }
  if (command === "version" && args.length === 1) {
    const location = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(await readFile(resolve(location, "../package.json"), "utf8")) as { version: string };
    stdout.write(`Guild Operations ${manifest.version}\n`);
    return "continue";
  }
  if ((command === "exit" || command === "quit") && args.length === 1 && interactive) {
    return "exit";
  }
  stderr.write(`Unknown Host Tools command: ${args.join(" ")}\nType 'help' for available commands.\n`);
  return "invalid";
}

async function main(args: string[]): Promise<void> {
  if (args.length > 0) {
    if (await dispatch(args, false) === "invalid") process.exitCode = 2;
    return;
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    stderr.write("Interactive Host Tools requires a terminal. Use './go help' for direct commands.\n");
    process.exitCode = 2;
    return;
  }
  stdout.write("Guild Operations — Host Tools\nType 'help' for commands; 'exit' or Ctrl+D to leave.\n\n");
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  rl.on("SIGINT", () => rl.close());
  rl.setPrompt("go> ");
  rl.prompt();
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) {
      // Initial commands take no arguments. Extend parsing when commands need quoted values.
      const outcome = await dispatch(trimmed.split(/\\s+/), true);
      if (outcome === "exit") break;
    }
    rl.prompt();
  }
  rl.close();
}

main(argv.slice(2)).catch((error: unknown) => {
  stderr.write(`Host Tools failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
