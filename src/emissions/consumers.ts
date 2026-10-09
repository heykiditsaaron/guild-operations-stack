import { registerDiscordRaidEmissionConsumer } from "../integrations/discord/raid-projection.js";
import { registerDiscordArticleEmissionConsumer } from "../integrations/discord/article-projection.js";
import { registerGuildCalendarEmissionConsumers } from "../core/calendar/emissions.js";

export function registerApplicationEmissionConsumers(): void {
  registerGuildCalendarEmissionConsumers();
  registerDiscordArticleEmissionConsumer();
  registerDiscordRaidEmissionConsumer();
}
