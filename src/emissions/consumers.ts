import { registerGuildCalendarEmissionConsumers } from "../guild-events/calendar/emissions.js";
import { registerDiscordEmissionConsumers } from "../plugins/discord/emissions.js";

export function registerApplicationEmissionConsumers(): void {
  registerGuildCalendarEmissionConsumers();
  registerDiscordEmissionConsumers();
}
