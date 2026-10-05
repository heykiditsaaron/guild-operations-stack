import { pool } from "../../db.js";
import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";

export type GuildHomepageCard = {
  title: string;
  body: string;
};

export type GuildHomepageSection =
  | {
      kind: "cards";
      kicker: string | null;
      heading: string | null;
      body: string | null;
      layout: "single" | "double" | "triple";
      cards: GuildHomepageCard[];
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
  sections: GuildHomepageSection[];
};

export const EMPTY_GUILD_HOMEPAGE: GuildHomepage = {
  lede: null,
  supportingText: null,
  sections: [],
};

function compactText(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || null;
}

export function parseGuildHomepage(value: unknown): GuildHomepage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { lede?: unknown; supportingText?: unknown; sections?: unknown };
  const lede = compactText(candidate.lede ?? null);
  const supportingText = compactText(candidate.supportingText ?? null);
  if (lede === undefined || supportingText === undefined || !Array.isArray(candidate.sections) || candidate.sections.length > 12) return undefined;

  const sections: GuildHomepageSection[] = [];
  for (const rawSection of candidate.sections) {
    if (!rawSection || typeof rawSection !== "object") return undefined;
    const section = rawSection as { kind?: unknown; kicker?: unknown; heading?: unknown; body?: unknown; layout?: unknown; cards?: unknown };
    const kicker = compactText(section.kicker ?? null);
    const heading = compactText(section.heading ?? null);
    const body = compactText(section.body ?? null);
    if (kicker === undefined || heading === undefined || body === undefined) return undefined;

    if (section.kind === "statement") {
      if (!body) return undefined;
      sections.push({ kind: "statement", kicker, heading, body });
      continue;
    }

    if (section.kind !== "cards" || !["single", "double", "triple"].includes(String(section.layout)) || !Array.isArray(section.cards)) return undefined;
    const expectedCards = section.layout === "single" ? 1 : section.layout === "double" ? 2 : 3;
    if (section.cards.length !== expectedCards) return undefined;
    const cards: GuildHomepageCard[] = [];
    for (const rawCard of section.cards) {
      if (!rawCard || typeof rawCard !== "object") return undefined;
      const card = rawCard as { title?: unknown; body?: unknown };
      const title = compactText(card.title);
      const cardBody = compactText(card.body);
      if (!title || !cardBody) return undefined;
      cards.push({ title, body: cardBody });
    }
    sections.push({ kind: "cards", kicker, heading, body, layout: section.layout as "single" | "double" | "triple", cards });
  }

  return { lede, supportingText, sections };
}

export async function guildHomepage(): Promise<GuildHomepage> {
  const guildId = (await requireOperationalInstallationGuildBinding()).guildId;
  const [settingsResult, sectionResult] = await Promise.all([
    pool.query<{ lede: string | null; supporting_text: string | null }>(
      "SELECT lede, supporting_text FROM guild_homepage_settings WHERE guild_id = $1",
      [guildId],
    ),
    pool.query<{
      section_id: string;
      kind: "cards" | "statement";
      kicker: string | null;
      heading: string | null;
      body: string | null;
      layout: "single" | "double" | "triple" | null;
      card_position: number | null;
      card_title: string | null;
      card_body: string | null;
    }>(
      `SELECT s.section_id, s.kind, s.kicker, s.heading, s.body, s.layout,
              c.position AS card_position, c.title AS card_title, c.body AS card_body
         FROM guild_homepage_sections s
         LEFT JOIN guild_homepage_cards c ON c.section_id = s.section_id
        WHERE s.guild_id = $1
        ORDER BY s.position, c.position`,
      [guildId],
    ),
  ]);

  const sections: GuildHomepageSection[] = [];
  let currentSectionId: string | null = null;
  for (const row of sectionResult.rows) {
    if (row.section_id !== currentSectionId) {
      currentSectionId = row.section_id;
      if (row.kind === "statement") {
        sections.push({ kind: "statement", kicker: row.kicker, heading: row.heading, body: row.body ?? "" });
      } else {
        sections.push({ kind: "cards", kicker: row.kicker, heading: row.heading, body: row.body, layout: row.layout ?? "single", cards: [] });
      }
    }
    const current = sections[sections.length - 1];
    if (current?.kind === "cards" && row.card_title !== null && row.card_body !== null) {
      current.cards.push({ title: row.card_title, body: row.card_body });
    }
  }

  const settings = settingsResult.rows[0];
  return {
    lede: settings?.lede ?? null,
    supportingText: settings?.supporting_text ?? null,
    sections,
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
    await client.query("DELETE FROM guild_homepage_sections WHERE guild_id = $1", [guildId]);

    for (const [position, section] of homepage.sections.entries()) {
      const inserted = await client.query<{ section_id: string }>(
        `INSERT INTO guild_homepage_sections (guild_id, position, kind, kicker, heading, body, layout)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING section_id`,
        [guildId, position, section.kind, section.kicker, section.heading, section.body, section.kind === "cards" ? section.layout : null],
      );
      if (section.kind === "cards") {
        for (const [cardPosition, card] of section.cards.entries()) {
          await client.query(
            "INSERT INTO guild_homepage_cards (section_id, position, title, body) VALUES ($1, $2, $3, $4)",
            [inserted.rows[0].section_id, cardPosition, card.title, card.body],
          );
        }
      }
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
