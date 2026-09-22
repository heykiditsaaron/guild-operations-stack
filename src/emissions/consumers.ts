import { registerGuildCalendarEmissionConsumers } from "../guild-events/calendar/emissions.js";
import { registerDiscordEmissionConsumers } from "../modules/discord/emissions.js";

export function registerApplicationEmissionConsumers(): void {
  registerGuildCalendarEmissionConsumers();
  registerDiscordEmissionConsumers();
}
