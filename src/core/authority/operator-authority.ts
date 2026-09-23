import { config } from "../../config.js";

export function isConfiguredOperator(guildieId: string): boolean {
  return config.operatorGuildieId !== null && guildieId === config.operatorGuildieId;
}
