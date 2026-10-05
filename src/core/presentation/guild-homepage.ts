import { pool } from "../../db.js";
import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";

export type GuildHomepageCardLayout = "single" | "double" | "triple";

export type GuildHomepagePrimitive =
  | {
      kind: "card";
      layout: GuildHomepageCardLayout;
      heading: string;
      texts: string[];
    }
  | {
      kind: "statement";
      kicker: string | null;
      heading: string | null;
      body: string;
    };

export type GuildHomepage = {
  lede: string | null;
  supportingText: string | null;
  primitives: GuildHomepagePrimitive[];
};

export const INITIAL_GUILD_HOMEPAGE: GuildHomepage = {
  lede: "A guild built around good people, shared adventures, and playing the game your way.",
  supportingText: "People first. Low pressure, not low ambition.",
  primitives: [
    {
      kind: "statement",
      kicker: "Around here",
      heading: "You’re a human first, a player second.",
      body: "Push progression, chase improvement, collect everything, run keys, raid, explore, or just show up for the people. Competitive play belongs here. It just isn’t the price of belonging.",
    },
    {
      kind: "card",
      layout: "triple",
      heading: "How we play",
      texts: [
        "Play your own way — Growth is encouraged when you want it. Pressure, gatekeeping, and elitism are not.",
        "Choose your participation — Join the things you want to be part of. Different members engage with the guild in different ways.",
        "Real life wins — Commitment matters, but plans change and people have lives outside Azeroth.",
      ],
    },
    {
      kind: "card",
      layout: "single",
      heading: "Enjoy the chaos",
      texts: ["Mistakes happen. Laugh at the wipes, celebrate the crits, and pull again."],
    },
    {
      kind: "card",
      layout: "double",
      heading: "Find your place in it",
      texts: [
        "In Azeroth — Run the content you enjoy, join organized groups when they fit, and play at the level that makes the game fun for you.",
        "In Discord — Follow the channels and activity notifications you care about. Keep the rest quiet. Participation should fit you, not demand your attention.",
      ],
    },
    {
      kind: "statement",
      kicker: "The bottom line",
      heading: null,
      body: "Have fun, make friends, respect the people around you, and occasionally yell “OH CRIT, I Pulled!”",
    },
  ],
};

function compactText(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function cardLayout(value: unknown): GuildHomepageCardLayout | undefined {
  return value === "single" || value === "double" || value === "triple" ? value : undefined;
}

function expectedTextCount(layout: GuildHomepageCardLayout): number {
  return layout === "triple" ? 3 : layout === "double" ? 2 : 1;
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
    const primitive = rawPrimitive as { kind?: unknown; layout?: unknown; kicker?: unknown; heading?: unknown; body?: unknown; texts?: unknown };
    const heading = compactText(primitive.heading ?? null);
    if (heading === undefined) return undefined;

    if (primitive.kind === "card") {
      const layout = cardLayout(primitive.layout);
      if (!layout || !heading || !Array.isArray(primitive.texts) || primitive.texts.length !== expectedTextCount(layout)) return undefined;
      const texts = primitive.texts.map(compactText);
      if (texts.some((text) => !text)) return undefined;
      primitives.push({ kind: "card", layout, heading, texts: texts as string[] });
      continue;
    }

    if (primitive.kind !== "statement") return undefined;
    const kicker = compactText(primitive.kicker ?? null);
    const body = compactText(primitive.body ?? null);
    if (kicker === undefined || body === undefined || !body) return undefined;
    primitives.push({ kind: "statement", kicker, heading, body });
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
      layout: GuildHomepageCardLayout;
      kicker: string | null;
      heading: string | null;
      body: string;
      text_cells: unknown;
    }>(
      `SELECT kind, layout, kicker, heading, body, text_cells
         FROM guild_homepage_primitives
        WHERE guild_id = $1
        ORDER BY position`,
      [guildId],
    ),
  ]);

  const settings = settingsResult.rows[0];
  if (!settings && primitiveResult.rows.length === 0) return INITIAL_GUILD_HOMEPAGE;

  const primitives: GuildHomepagePrimitive[] = primitiveResult.rows.map((row) => {
    if (row.kind === "card") {
      const texts = Array.isArray(row.text_cells) ? row.text_cells.filter((value): value is string => typeof value === "string") : [row.body];
      return { kind: "card", layout: row.layout, heading: row.heading ?? "", texts };
    }
    return { kind: "statement", kicker: row.kicker, heading: row.heading, body: row.body };
  });

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
        `INSERT INTO guild_homepage_primitives (guild_id, position, kind, layout, kicker, heading, body, text_cells)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          guildId,
          position,
          primitive.kind,
          primitive.kind === "card" ? primitive.layout : "single",
          primitive.kind === "statement" ? primitive.kicker : null,
          primitive.heading,
          primitive.kind === "statement" ? primitive.body : "",
          JSON.stringify(primitive.kind === "card" ? primitive.texts : []),
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
