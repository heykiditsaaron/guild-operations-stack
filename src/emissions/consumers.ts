import { registerGuildCalendarEmissionConsumers } from "../core/calendar/emissions.js";
import { registerDiscordEmissionConsumers } from "../plugins/discord/emissions.js";

export function registerApplicationEmissionConsumers(): void {
  registerGuildCalendarEmissionConsumers();
  registerDiscordEmissionConsumers();
}
