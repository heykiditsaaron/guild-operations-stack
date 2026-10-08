import type { AssetRegistry } from "../../web/assets.js";
import { discordEnsureApplicationEmoji, type DiscordApplicationEmoji } from "./api.js";

/** Reuse the role artwork already shipped with the raid UI. */
export function raidRoleEmojiImage(assets: AssetRegistry, role: "tank" | "healer" | "damage"): string {
  const css = assets.get("raid-iconography.css")?.body.toString("utf8");
  if (!css) throw new Error("raid_iconography_unavailable");
  const expression = new RegExp(`--raid-role-${role}-icon:\\s*url\\(["']?(data:image\\/png;base64,[A-Za-z0-9+/=]+)["']?\\)`);
  const image = css.match(expression)?.[1];
  if (!image) throw new Error("raid_role_icon_unavailable");
  const size = Buffer.from(image.slice("data:image/png;base64,".length), "base64").byteLength;
  if (size > 256 * 1024) throw new Error("raid_role_icon_too_large");
  return image;
}

export async function provisionRaidRoleEmoji(input: {
  assets: AssetRegistry;
  botToken: string;
  applicationId: string;
  role: "tank" | "healer" | "damage";
}): Promise<DiscordApplicationEmoji> {
  return discordEnsureApplicationEmoji({
    botToken: input.botToken,
    applicationId: input.applicationId,
    name: `go_raid_${input.role}`,
    imageData: raidRoleEmojiImage(input.assets, input.role),
  });
}
