import { config } from "../../config.js";

export function hasDevelopmentGuildMasterAuthority(identityId: string): boolean {
  return config.developmentAuthorityGuildieId !== null
    && identityId === config.developmentAuthorityGuildieId;
}
