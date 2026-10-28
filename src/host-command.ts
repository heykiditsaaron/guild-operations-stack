import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pool, withTransaction } from "./db.js";
import { installationGuildBinding } from "./core/installation/guild-binding.js";
import { resolveConfiguredInstallationGuild } from "./core/installation/guild-binding.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "rebind" || !(args.length === 0 || (args.length === 1 && ["cancel", "confirm"].includes(args[0])))) {
    throw new Error("Usage: node dist/host-command.js rebind | rebind confirm | rebind cancel");
  }
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("Rebinding requires an interactive host terminal");
  if (args[0] === "cancel") {
    const pending = await pool.query<{ request_id: string; guild_name: string; realm_slug: string; region: string }>(
      "SELECT request_id, guild_name, realm_slug, region FROM installation_rebind_requests WHERE completed_at IS NULL AND cancelled_at IS NULL",
    );
    const request = pending.rows[0];
    if (!request) { stdout.write("No pending rebind request.\n"); return; }
    stdout.write(`Pending destination: ${request.guild_name} (${request.realm_slug}, ${request.region})\n`);
    const rl = createInterface({ input: stdin, output: stdout });
    let confirmation: string;
    try { confirmation = await rl.question(`Type "${request.guild_name}" to cancel this request: `); }
    finally { rl.close(); }
    if (confirmation !== request.guild_name) { stdout.write("No changes made.\n"); return; }
    const cancelled = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(256, 1)");
      return client.query(
        "UPDATE installation_rebind_requests SET cancelled_at = now() WHERE request_id = $1 AND completed_at IS NULL AND cancelled_at IS NULL",
        [request.request_id],
      );
    });
    stdout.write(cancelled.rowCount ? "Pending rebind request cancelled.\n" : "Request already completed or cancelled.\n");
    return;
  }
  const binding = await installationGuildBinding();
  if (!binding?.authorizedAt) throw new Error("Installation must be operational before rebinding");
  const pendingExisting = await pool.query(
    "SELECT request_id FROM installation_rebind_requests WHERE completed_at IS NULL AND cancelled_at IS NULL",
  );
  if (pendingExisting.rowCount) throw new Error("A rebind request is already pending; cancel it before starting another");
  const previous = await pool.query<{ name: string; realm_slug: string; region: string }>(
    "SELECT name, realm_slug, region FROM guilds WHERE guild_id = $1", [binding.guildId],
  );
  const current = previous.rows[0];
  stdout.write(`Current guild: ${current?.name ?? binding.guildId} (${current?.realm_slug ?? "unknown"}, ${current?.region ?? "unknown"})\n`);
  if (args.length === 0) {
    stdout.write("Manually review or edit GUILD_REGION, GUILD_REALM, and GUILD_NAME in the host .env file.\n");
    stdout.write("After saving, run rebind confirm as a NEW Compose invocation to load the updated environment.\n");
    stdout.write("No request has been created.\n");
    return;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  let region: string;
  let realmSlug: string;
  let guildName: string;
  try {
    const reviewed = await rl.question('Type "reviewed" after reviewing and saving the host .env: ');
    if (reviewed !== "reviewed") { stdout.write("Cancelled. No changes made.\n"); return; }
    // This fresh Compose invocation receives the current host .env.
    stdout.write("Reading the configured destination from this command's environment.\n");
    const target = await resolveConfiguredInstallationGuild();
    region = target.region;
    if (!target.profile.realm.slug) throw new Error("Blizzard guild profile omitted realm slug");
    realmSlug = target.profile.realm.slug;
    guildName = target.profile.name;
    if (String(target.profile.id) === binding.guildId) {
      stdout.write("The configured destination is already bound. No rebind request created.\n");
      return;
    }
    stdout.write(`Destination: ${guildName} (${realmSlug}, ${region})\n`);
    stdout.write("Rebinding resets guild-owned permissions and integration configuration. Member identities and history remain.\n");
    const confirmation = await rl.question(`Type "${guildName}" to request rebinding: `);
    if (confirmation !== guildName) { stdout.write("Cancelled. No changes made.\n"); return; }
  } finally { rl.close(); }
  const requestId = randomUUID();
  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(256, 1)");
    const pending = await client.query("SELECT request_id FROM installation_rebind_requests WHERE completed_at IS NULL AND cancelled_at IS NULL FOR UPDATE");
    if (pending.rowCount) throw new Error("A rebind request is already pending; no new request created");
    await client.query(
      "INSERT INTO installation_rebind_requests (request_id, region, realm_slug, guild_name) VALUES ($1,$2,$3,$4)",
      [requestId, region, realmSlug, guildName],
    );
  });
  stdout.write(`Rebind request ${requestId} is pending destination Guild Master authorization.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(() => pool.end());
