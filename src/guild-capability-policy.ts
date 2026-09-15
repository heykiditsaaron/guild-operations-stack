import type { PoolClient } from "pg";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import {
  GUILD_REFRESH_CAPABILITY,
  GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY,
  MODULES_CONFIGURE_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  type GuildCapability,
  effectiveGuildAuthority,
} from "./guild-permissions.js";
import { registerGuildRefreshObserver } from "./guild-refresh-observers.js";
import { isConfiguredOperator } from "./operator-authority.js";

export type GuildCapabilityDefinition = {
  key: GuildCapability;
  namespace: string;
  namespaceLabel: string;
  label: string;
  description?: string;
  defaultPermittedRanks?: readonly number[];
};
export type GuildRankOption = { rankIndex: number; displayName: string; active: boolean };
export type GuildCapabilityPolicy = Omit<GuildCapabilityDefinition, "defaultPermittedRanks"> & { permittedRanks: number[] };
export type GuildCapabilityPolicySet = { ranks: GuildRankOption[]; capabilities: GuildCapabilityPolicy[] };

const definitions = new Map<GuildCapability, GuildCapabilityDefinition>();
let observerRegistered = false;

export function registerGuildCapabilityDefinitions(contributed: readonly GuildCapabilityDefinition[]): void {
  for (const definition of contributed) {
    const existing = definitions.get(definition.key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(definition)) throw new Error(`Guild capability definition already registered: ${definition.key}`);
    definitions.set(definition.key, { ...definition, defaultPermittedRanks: definition.defaultPermittedRanks?.filter((rankIndex) => rankIndex !== 0) });
  }
}

export function registerGlobalGuildCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions([
    { key: GUILD_REFRESH_CAPABILITY, namespace: "global", namespaceLabel: "Global", label: "Refresh guild", description: "Perform an immediate reconciliation of current guild membership and rank authority from Blizzard.", defaultPermittedRanks: [1, 2] },
    { key: GUILD_REFRESH_SCHEDULE_CONFIGURE_CAPABILITY, namespace: "global", namespaceLabel: "Global", label: "Configure guild refresh schedule", description: "Configure automatic guild synchronization policy.", defaultPermittedRanks: [1, 2] },
    { key: MODULES_CONFIGURE_CAPABILITY, namespace: "global", namespaceLabel: "Global", label: "Configure modules", description: "Enable or disable installed Guild Operations modules.", defaultPermittedRanks: [] },
    { key: OPERATIONS_INSPECT_CAPABILITY, namespace: "global", namespaceLabel: "Global", label: "Inspect operations", description: "Inspect operational history and recorded failures.", defaultPermittedRanks: [1, 2] },
  ]);
}

export function registerGuildCapabilityPolicyObserver(): void {
  if (observerRegistered) return;
  observerRegistered = true;
  registerGuildRefreshObserver(async ({ guildId }) => { await ensureGuildCapabilityPolicies(guildId); });
}
export function registeredGuildCapabilityDefinitions(): GuildCapabilityDefinition[] { return [...definitions.values()]; }

export async function canAdministerGuildPermissions(guildieId: string, guildId: string = config.guild.id): Promise<boolean> {
  if (isConfiguredOperator(guildieId)) return true;
  const authority = await effectiveGuildAuthority(guildieId, guildId);
  return authority?.rankIndex === 0;
}
export async function requireGuildPermissionAdministration(guildieId: string, guildId: string = config.guild.id): Promise<void> {
  if (!await canAdministerGuildPermissions(guildieId, guildId)) throw new Error("Guildie cannot administer guild permissions");
}

function configurableRanks(permittedRanks: readonly number[]): number[] {
  return [...new Set(permittedRanks.filter((rankIndex) => rankIndex !== 0))].sort((a, b) => a - b);
}

async function replaceCapabilityProjection(client: PoolClient, guildId: string, capability: string, permittedRanks: readonly number[]): Promise<void> {
  await client.query(`DELETE FROM guild_rank_capabilities WHERE guild_id = $1 AND capability = $2`, [guildId, capability]);
  for (const rankIndex of configurableRanks(permittedRanks)) await client.query(`INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability) VALUES ($1, $2, $3) ON CONFLICT (guild_id, rank_index, capability) DO NOTHING`, [guildId, rankIndex, capability]);
}

export async function ensureGuildCapabilityPolicies(guildId: string = config.guild.id): Promise<void> {
  const capabilityDefinitions = registeredGuildCapabilityDefinitions();
  if (capabilityDefinitions.length === 0) return;
  await withTransaction(async (client) => {
    const ranksResult = await client.query<{ rank_index: number }>(`SELECT rank_index FROM guild_rank_definitions WHERE guild_id = $1`, [guildId]);
    const knownRanks = new Set(ranksResult.rows.map((row) => row.rank_index));
    for (const definition of capabilityDefinitions) {
      const configured = await client.query<{ permitted_ranks: number[] }>(`SELECT permitted_ranks FROM guild_capability_policy_configuration WHERE guild_id = $1 AND capability = $2`, [guildId, definition.key]);
      let permittedRanks = configured.rows[0]?.permitted_ranks;
      if (!permittedRanks) {
        const existing = await client.query<{ rank_index: number }>(`SELECT rank_index FROM guild_rank_capabilities WHERE guild_id = $1 AND capability = $2 ORDER BY rank_index`, [guildId, definition.key]);
        permittedRanks = existing.rows.length > 0 ? existing.rows.map((row) => row.rank_index) : [...(definition.defaultPermittedRanks ?? [])].filter((rankIndex) => knownRanks.has(rankIndex));
      }
      permittedRanks = configurableRanks(permittedRanks).filter((rankIndex) => knownRanks.has(rankIndex));
      await client.query(`INSERT INTO guild_capability_policy_configuration (guild_id, capability, permitted_ranks, updated_at) VALUES ($1, $2, $3::integer[], now()) ON CONFLICT (guild_id, capability) DO UPDATE SET permitted_ranks = EXCLUDED.permitted_ranks, updated_at = CASE WHEN guild_capability_policy_configuration.permitted_ranks IS DISTINCT FROM EXCLUDED.permitted_ranks THEN now() ELSE guild_capability_policy_configuration.updated_at END`, [guildId, definition.key, permittedRanks]);
      await replaceCapabilityProjection(client, guildId, definition.key, permittedRanks);
    }
  });
}

export async function guildCapabilityPolicies(guildId: string = config.guild.id): Promise<GuildCapabilityPolicySet> {
  await ensureGuildCapabilityPolicies(guildId);
  const capabilityDefinitions = registeredGuildCapabilityDefinitions();
  const [ranksResult, policiesResult] = await Promise.all([
    pool.query<{ rank_index: number; display_name: string | null; active: boolean }>(`SELECT rank_index, display_name, active FROM guild_rank_definitions WHERE guild_id = $1 ORDER BY rank_index`, [guildId]),
    pool.query<{ capability: string; permitted_ranks: number[] }>(`SELECT capability, permitted_ranks FROM guild_capability_policy_configuration WHERE guild_id = $1 AND capability = ANY($2::text[])`, [guildId, capabilityDefinitions.map((definition) => definition.key)]),
  ]);
  const configured = new Map(policiesResult.rows.map((row) => [row.capability, configurableRanks(row.permitted_ranks)]));
  return {
    ranks: ranksResult.rows.map((rank) => ({ rankIndex: rank.rank_index, displayName: rank.display_name ?? `Rank ${rank.rank_index}`, active: rank.active })),
    capabilities: capabilityDefinitions.map(({ defaultPermittedRanks: _defaults, ...definition }) => ({ ...definition, permittedRanks: configured.get(definition.key) ?? [] })),
  };
}

export async function permittedGuildRanksForCapability(capability: GuildCapability, guildId: string = config.guild.id): Promise<number[]> {
  await ensureGuildCapabilityPolicies(guildId);
  const result = await pool.query<{ permitted_ranks: number[] }>(`SELECT permitted_ranks FROM guild_capability_policy_configuration WHERE guild_id = $1 AND capability = $2`, [guildId, capability]);
  return configurableRanks(result.rows[0]?.permitted_ranks ?? []);
}

export async function setGuildCapabilityPermittedRanks(actorGuildieId: string, capability: GuildCapability, permittedRanks: readonly number[], guildId: string = config.guild.id): Promise<number[]> {
  await requireGuildPermissionAdministration(actorGuildieId, guildId);
  if (!definitions.has(capability)) throw new Error("Unknown configurable guild capability");
  if (permittedRanks.some((rankIndex) => !Number.isInteger(rankIndex) || rankIndex < 0)) throw new Error("Guild permission rank is invalid");
  const normalized = configurableRanks(permittedRanks);
  await withTransaction(async (client) => {
    const rankResult = await client.query<{ rank_index: number }>(`SELECT rank_index FROM guild_rank_definitions WHERE guild_id = $1`, [guildId]);
    const knownRanks = new Set(rankResult.rows.map((row) => row.rank_index));
    if (normalized.some((rankIndex) => !knownRanks.has(rankIndex))) throw new Error("Guild permission update referenced an unknown guild rank");
    await client.query(`INSERT INTO guild_capability_policy_configuration (guild_id, capability, permitted_ranks, updated_at) VALUES ($1, $2, $3::integer[], now()) ON CONFLICT (guild_id, capability) DO UPDATE SET permitted_ranks = EXCLUDED.permitted_ranks, updated_at = now()`, [guildId, capability, normalized]);
    await replaceCapabilityProjection(client, guildId, capability, normalized);
  });
  return normalized;
}
