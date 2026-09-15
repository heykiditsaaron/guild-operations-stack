import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import type { GuildEventInteraction, GuildEventOccurrence, GuildEventPublication, GuildEventPublicationInput } from "./contract.js";

function normalizeOccurrence(occurrence: GuildEventOccurrence): GuildEventOccurrence {
  if (occurrence.length !== 1 && occurrence.length !== 2) throw new Error("Each occurrence must contain one or two Unix timestamps");
  for (const value of occurrence) if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Occurrence values must be positive Unix timestamps");
  if (occurrence.length === 2 && occurrence[1] < occurrence[0]) throw new Error("Occurrence end must not precede start");
  return occurrence.length === 1 ? [occurrence[0]] : [occurrence[0], occurrence[1]];
}

function normalize(input: GuildEventPublicationInput) {
  const publicationId = input.publicationId.trim();
  const label = input.label.trim();
  if (!publicationId || !label) throw new Error("Publication id and label are required");
  if (!input.occursAt.length) throw new Error("A publication requires at least one occurrence");
  const occursAt = input.occursAt.map(normalizeOccurrence);
  const interactions: GuildEventInteraction[] = (input.interactions ?? []).map((value) => ({ kind: value.kind.trim(), label: value.label.trim(), destination: value.destination.trim() }));
  if (interactions.some((value) => !value.kind || !value.label || !value.destination)) throw new Error("Publication interactions require kind, label, and destination");
  return { publicationId, label, occursAt, description: input.description?.trim() || null, category: input.category?.trim() || null,
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))], interactions };
}

function mapOccurrence(value: unknown): GuildEventOccurrence {
  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) throw new Error("Stored event occurrence is invalid");
  const numbers = value.map(Number);
  return numbers.length === 1 ? [numbers[0]] : [numbers[0], numbers[1]];
}

function mapRow(row: any): GuildEventPublication {
  return { publicationId: row.publication_id, label: row.label, occursAt: row.occurs_at.map(mapOccurrence), description: row.description,
    category: row.category, tags: row.tags, interactions: row.interactions, publishedAtUnix: Number(row.published_at_unix), updatedAtUnix: Number(row.updated_at_unix) };
}

const columns = "publication_id,label,occurs_at,description,category,tags,interactions,published_at_unix,updated_at_unix";

export async function establishGuildEventPublication(input: GuildEventPublicationInput, client: PoolClient | null = null): Promise<GuildEventPublication> {
  const publication = normalize(input);
  const now = Math.floor(Date.now() / 1000);
  const result = await (client ?? pool).query(
    `INSERT INTO guild_event_publications (publication_id,label,occurs_at,description,category,tags,interactions,published,published_at_unix,updated_at_unix)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,true,$8,$8)
     ON CONFLICT (publication_id) DO UPDATE SET label=EXCLUDED.label,occurs_at=EXCLUDED.occurs_at,description=EXCLUDED.description,category=EXCLUDED.category,
       tags=EXCLUDED.tags,interactions=EXCLUDED.interactions,published=true,updated_at_unix=EXCLUDED.updated_at_unix
     RETURNING ${columns}`,
    [publication.publicationId, publication.label, JSON.stringify(publication.occursAt), publication.description, publication.category,
      publication.tags, JSON.stringify(publication.interactions), now]);
  return mapRow(result.rows[0]);
}

export async function withdrawGuildEventPublication(publicationId: string, client: PoolClient | null = null): Promise<boolean> {
  const result = await (client ?? pool).query("UPDATE guild_event_publications SET published=false,updated_at_unix=$2 WHERE publication_id=$1 AND published=true", [publicationId, Math.floor(Date.now()/1000)]);
  return (result.rowCount ?? 0) > 0;
}

export async function guildEventPublication(publicationId: string): Promise<GuildEventPublication | null> {
  const result = await pool.query(`SELECT ${columns} FROM guild_event_publications WHERE publication_id=$1 AND published=true`, [publicationId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function publishedGuildEvents(): Promise<GuildEventPublication[]> {
  const result = await pool.query(`SELECT ${columns} FROM guild_event_publications WHERE published=true ORDER BY updated_at_unix ASC, publication_id ASC`);
  return result.rows.map(mapRow);
}
