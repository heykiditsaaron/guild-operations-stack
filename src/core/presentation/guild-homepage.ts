import { pool } from "../../db.js";
import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";

export type GuildHomepageWidth = "full" | "half" | "third";

export type GuildHomepagePrimitive =
  | {
      kind: "card";
      width: GuildHomepageWidth;
      heading: string;
      body: string;
    }
  | {
      kind: "statement";
      width: GuildHomepageWidth;
      kicker: string | null;
      heading: string | null;
      body: string;
    };

export type GuildHomepage = {
  lede: string | null;
  supportingText: string | null;
  primitives: GuildHomepagePrimitive[];
};

export const EMPTY_GUILD_HOMEPAGE: GuildHomepage = {
  lede: null,
  supportingText: null,
  primitives: [],
};

function compactText(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function homepageWidth(value: unknown): GuildHomepageWidth | undefined {
  return value === "full" || value === "half" || value === "third" ? value : undefined;
}

export function parseGuildHomepage(value: unknown): GuildHomepage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { lede?: unknown; supportingText?: unknown; primitives?: unknown };
  const lede = compactText(candidate.lede ?? null);
  const supportingText = compactText(candidate.supportingText ?? null);
  if (lede === undefined || supportingText === undefined || !Array.isArray(candidate.primitives) || candidate.primitives.length > 24) return undefined;

  const primitives: GuildHomepagePrimitive[] = [];
  for (const rawPrimitive of candidate.primitives) {
    if (!rawPrimitive || typeof rawPrimitive !== "object") return undefined;
    const primitive = rawPrimitive as { kind?: unknown; width?: unknown; kicker?: unknown; heading?: unknown; body?: unknown };
    const width = homepageWidth(primitive.width);
    const heading = compactText(primitive.heading ?? null);
    const body = compactText(primitive.body ?? null);
    if (!width || heading === undefined || body === undefined || !body) return undefined;

    if (primitive.kind === "card") {
      if (!heading) return undefined;
      primitives.push({ kind: "card", width, heading, body });
      continue;
    }

    if (primitive.kind !== "statement") return undefined;
    const kicker = compactText(primitive.kicker ?? null);
    if (kicker === undefined) return undefined;
    primitives.push({ kind: "statement", width, kicker, heading, body });
  }

  return { lede, supportingText, primitives };
}

export async function guildHomepage(): Promise<GuildHomepage> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const [settingsResult, primitiveResult] = await Promise.all([
    pool.query<{ lede: string | null; supporting_text: string | null }>(
      "SELECT lede, supporting_text FROM guild_homepage_settings WHERE guild_id = $1",
      [guildId],
    ),
    pool.query<{
      kind: "card" | "statement";
      width: GuildHomepageWidth;
      kicker: string | null;
      heading: string | null;
      body: string;
    }>(
      `SELECT kind, width, kicker, heading, body
         FROM guild_homepage_primitives
        WHERE guild_id = $1
        ORDER BY position`,
      [guildId],
    ),
  ]);

  const primitives: GuildHomepagePrimitive[] = primitiveResult.rows.map((row) =>
    row.kind === "card"
      ? { kind: "card", width: row.width, heading: row.heading ?? "", body: row.body }
      : { kind: "statement", width: row.width, kicker: row.kicker, heading: row.heading, body: row.body },
  );

  const settings = settingsResult.rows[0];
  return {
    lede: settings?.lede ?? null,
    supportingText: settings?.supporting_text ?? null,
    primitives,
  };
}

export async function setGuildHomepage(homepage: GuildHomepage): Promise<GuildHomepage> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO guild_homepage_settings (guild_id, lede, supporting_text, updated_at_unix)
       VALUES ($1, $2, $3, extract(epoch FROM now())::bigint)
       ON CONFLICT (guild_id) DO UPDATE SET
         lede = EXCLUDED.lede,
         supporting_text = EXCLUDED.supporting_text,
         updated_at_unix = EXCLUDED.updated_at_unix`,
      [guildId, homepage.lede, homepage.supportingText],
    );
    await client.query("DELETE FROM guild_homepage_primitives WHERE guild_id = $1", [guildId]);

    for (const [position, primitive] of homepage.primitives.entries()) {
      await client.query(
        `INSERT INTO guild_homepage_primitives (guild_id, position, kind, width, kicker, heading, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          guildId,
          position,
          primitive.kind,
          primitive.width,
          primitive.kind === "statement" ? primitive.kicker : null,
          primitive.heading,
          primitive.body,
        ],
      );
    }
    await client.query("COMMIT");
    return homepage;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
