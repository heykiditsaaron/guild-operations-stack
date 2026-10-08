import type { AssetRegistry } from "../../web/assets.js";
import { allWowSpecTraitDefinitions } from "../../wow-traits/registry.js";
import { specializationIconUrl } from "../../wow-iconography.js";
import { discordApplicationEmojis, discordCreateApplicationEmoji, type DiscordApplicationEmoji } from "./api.js";
import { raidRoleEmojiImage } from "./role-emoji.js";

export type EmojiSetupResult = {
  emojis: DiscordApplicationEmoji[];
  created: number;
  reused: number;
  unavailable: string[];
};

function specEmojiName(className: string, specName: string): string {
  const part = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `go_spec_${part(className)}_${part(specName)}`;
}

async function imageDataFromUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("invalid_specialization_icon_url");
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`specialization_icon_http_${response.status}`);
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!type || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) {
    throw new Error("unsupported_specialization_icon_format");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 256 * 1024) throw new Error("specialization_icon_too_large");
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Reconcile only Guild Operations-owned names. Never delete or modify other application emojis. */
export async function provisionDiscordPresentationEmojis(input: {
  assets: AssetRegistry;
  botToken: string;
  applicationId: string;
}): Promise<EmojiSetupResult> {
  const known = new Map((await discordApplicationEmojis(input.botToken, input.applicationId)).map((emoji) => [emoji.name, emoji]));
  const emojis: DiscordApplicationEmoji[] = [];
  const unavailable: string[] = [];
  let created = 0;
  let reused = 0;
  async function ensure(name: string, image: () => Promise<string>): Promise<void> {
    const existing = known.get(name);
    if (existing) { emojis.push(existing); reused++; return; }
    try {
      const emoji = await discordCreateApplicationEmoji({
        botToken: input.botToken, applicationId: input.applicationId, name, imageData: await image(),
      });
      known.set(name, emoji);
      emojis.push(emoji);
      created++;
    } catch {
      unavailable.push(name);
    }
  }

  for (const role of ["tank", "healer", "damage"] as const) {
    await ensure(`go_raid_${role}`, async () => raidRoleEmojiImage(input.assets, role));
  }
  for (const spec of allWowSpecTraitDefinitions()) {
    const name = specEmojiName(spec.className, spec.specName);
    await ensure(name, async () => {
      const url = await specializationIconUrl(spec.className, spec.specName);
      if (!url) throw new Error("specialization_icon_unavailable");
      return imageDataFromUrl(url);
    });
  }
  return { emojis, created, reused, unavailable };
}
