import { parseRegion, type Region } from "../../config.js";

export type InstallationGuildTarget = {
  region: Region;
  realmSlug: string;
  name: string;
  nameSlug: string;
};

export function configuredInstallationGuild(): InstallationGuildTarget | null {
  const region = parseRegion(process.env.GUILD_REGION);
  const realmSlug = process.env.GUILD_REALM?.trim().toLowerCase();
  const name = process.env.GUILD_NAME?.trim();
  if (!region || !realmSlug || !name) return null;
  const nameSlug = name.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!nameSlug) return null;
  return { region, realmSlug, name, nameSlug };
}

