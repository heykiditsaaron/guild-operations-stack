import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import type { GuildEventInteraction, GuildEventOccursAt, GuildEventPublication, GuildEventPublicationInput } from "./contract.js";

function normalize(input: GuildEventPublicationInput): Required<Omit<GuildEventPublicationInput, "description">> & { description: string | null } {
  const publicationId = input.publicationId.trim();
  const title = input.title.trim();
  const category = input.category.trim();
  if (!publicationId || !title || !category) throw new Error("Publication id, title, and category are required");
  if (input.occursAt.length !== 1 && input.occursAt.length !== 2) throw new Error("occursAt must contain one or two Unix timestamps");
  for (const value of input.occursAt) if (!Number.isSafeInteger(value) || value <= 0) throw new Error("occursAt values must be positive Unix timestamps");
  if (input.occursAt.length === 2 && input.occursAt[1] < input.occursAt[0]) throw new Error("occursAt end must not precede start");
  const interactions: GuildEventInteraction[] = (input.interactions ?? []).map((value) => ({
    kind: value.kind.trim(), label: value.label.trim(), destination: value.destination.trim(),
  }));
  if (interactions.some((value) => !value.kind || !value.label || !value.destination)) throw new Error("Publication interactions require kind, label, and destination");
  return { publicationId, title, description: input.description?.trim() || null, occursAt: input.occursAt, category,
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))], interactions };
}

function mapRow(row: any): GuildEventPublication {
  const start = Number(row.occurs_start_unix);
  const end = row.occurs_end_unix === null ? null : Number(row.occurs_end_unix);
  return { publicationId: row.publication_id, title: row.title, description: row.description,
    occursAt: end === null ? [start] : [start, end], category: row.category, tags: row.tags,
    interactions: row.interactions, publishedAtUnix: Number(row.published_at_unix), updatedAtUnix: Number(row.updated_at_unix) };
}

export async function establishGuildEventPublication(input: GuildEventPublicationInput, client: PoolClient | null = null): Promise<GuildEventPublication> {
  const publication = normalize(input);
  const executor = client ?? pool;
  const now = Math.floor(Date.now() / 1000);
  const result = await executor.query(
    `INSERT INTO guild_event_publications (publication_id,title,description,occurs_start_unix,occurs_end_unix,category,tags,interactions,published,published_at_unix,updated_at_unix)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,true,$9,$9)
     ON CONFLICT (publication_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,occurs_start_unix=EXCLUDED.occurs_start_unix,
       occurs_end_unix=EXCLUDED.occurs_end_unix,category=EXCLUDED.category,tags=EXCLUDED.tags,interactions=EXCLUDED.interactions,published=true,updated_at_unix=EXCLUDED.updated_at_unix
     RETURNING publication_id,title,description,occurs_start_unix,occurs_end_unix,category,tags,interactions,published_at_unix,updated_at_unix`,
    [publication.publicationId,publication.title,publication.description,publication.occursAt[0],publication.occursAt.length === 2 ? publication.occursAt[1] : null,
      publication.category,publication.tags,JSON.stringify(publication.interactions),now]);
  return mapRow(result.rows[0]);
}

export async function withdrawGuildEventPublication(publicationId: string, client: PoolClient | null = null): Promise<boolean> {
  const result = await (client ?? pool).query(`UPDATE guild_event_publications SET published=false,updated_at_unix=$2 WHERE publication_id=$1 AND published=true`,
    [publicationId,Math.floor(Date.now()/1000)]);
  return (result.rowCount ?? 0) > 0;
}

export async function guildEventPublication(publicationId: string): Promise<GuildEventPublication | null> {
  const result = await pool.query(`SELECT publication_id,title,description,occurs_start_unix,occurs_end_unix,category,tags,interactions,published_at_unix,updated_at_unix FROM guild_event_publications WHERE publication_id=$1 AND published=true`,[publicationId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function publishedGuildEvents(): Promise<GuildEventPublication[]> {
  const result = await pool.query(`SELECT publication_id,title,description,occurs_start_unix,occurs_end_unix,category,tags,interactions,published_at_unix,updated_at_unix FROM guild_event_publications WHERE published=true ORDER BY occurs_start_unix ASC,publication_id ASC`);
  return result.rows.map(mapRow);
}
