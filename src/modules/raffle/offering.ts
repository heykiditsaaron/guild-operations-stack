import { registerGuildActivityOffering } from "../../guild-activities/offerings/registry.js";

export const RAFFLE_GUILD_ACTIVITY_OFFERING_ID = "raffle";
export const RAFFLE_GUILD_ACTIVITY_OFFERING_TITLE = "Raffle";
export const RAFFLE_GUILD_ACTIVITY_OFFERING_TAGLINE = "Take your shot at the pot.";
export const RAFFLE_GUILD_ACTIVITY_OFFERING_DESTINATION = "/events/raffle";
export const RAFFLE_GUILD_ACTIVITY_OFFERING_ARTWORK = "images/raffle/gold-sack.png";

export function registerRaffleGuildActivityOffering(): void {
  registerGuildActivityOffering({
    offeringId: RAFFLE_GUILD_ACTIVITY_OFFERING_ID,
    title: RAFFLE_GUILD_ACTIVITY_OFFERING_TITLE,
    tagline: RAFFLE_GUILD_ACTIVITY_OFFERING_TAGLINE,
    destination: RAFFLE_GUILD_ACTIVITY_OFFERING_DESTINATION,
    artwork: {
      kind: "asset",
      asset: RAFFLE_GUILD_ACTIVITY_OFFERING_ARTWORK,
    },
  });
}
