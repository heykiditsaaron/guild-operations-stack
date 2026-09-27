import { pool, withTransaction } from "../../db.js";
import type { GuildCapabilityDefinition } from "../authority/guild-capability-policy.js";

export type ActivityCapabilityDeclaration = GuildCapabilityDefinition & { lastDeclaredAtUnix: number };

export async function rememberActivityCapabilityDeclarations(activityKind: string, capabilities: readonly GuildCapabilityDefinition[]): Promise<void> {
  const nowUnix = Math.floor(Date.now() / 1000);
  await withTransaction(async (client) => {
    const declared = capabilities.map((capability) => capability.key);
    for (const capability of capabilities) {
      await client.query(
        `INSERT INTO activity_plugin_capability_declarations
           (activity_kind, capability, namespace, namespace_label, label, description, default_permitted_ranks, last_declared_at_unix)
         VALUES ($1,$2,$3,$4,$5,$6,$7::integer[],$8)
         ON CONFLICT (activity_kind, capability) DO UPDATE SET
           namespace=EXCLUDED.namespace, namespace_label=EXCLUDED.namespace_label, label=EXCLUDED.label,
           description=EXCLUDED.description, default_permitted_ranks=EXCLUDED.default_permitted_ranks,
           last_declared_at_unix=EXCLUDED.last_declared_at_unix`,
        [activityKind, capability.key, capability.namespace, capability.namespaceLabel, capability.label, capability.description ?? null, [...(capability.defaultPermittedRanks ?? [])], nowUnix],
      );
    }
    if (declared.length === 0) await client.query(`DELETE FROM activity_plugin_capability_declarations WHERE activity_kind=$1`, [activityKind]);
    else await client.query(`DELETE FROM activity_plugin_capability_declarations WHERE activity_kind=$1 AND NOT (capability=ANY($2::text[]))`, [activityKind, declared]);
  });
}

export async function knownActivityCapabilityDeclarations(activityKind: string): Promise<ActivityCapabilityDeclaration[]> {
  const result = await pool.query<{ capability:string; namespace:string; namespace_label:string; label:string; description:string|null; default_permitted_ranks:number[]; last_declared_at_unix:string }>(
    `SELECT capability, namespace, namespace_label, label, description, default_permitted_ranks, last_declared_at_unix
       FROM activity_plugin_capability_declarations WHERE activity_kind=$1 ORDER BY capability`, [activityKind]);
  return result.rows.map((row) => ({ key:row.capability, namespace:row.namespace, namespaceLabel:row.namespace_label, label:row.label,
    ...(row.description===null?{}:{description:row.description}), defaultPermittedRanks:row.default_permitted_ranks, lastDeclaredAtUnix:Number(row.last_declared_at_unix) }));
}
