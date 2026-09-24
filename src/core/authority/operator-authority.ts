import { config } from "../../config.js";

export function hasDevelopmentGuildMasterAuthority(guildieId: string): boolean {
  return config.developmentAuthorityGuildieId !== null
    && guildieId === config.developmentAuthorityGuildieId;
}
