import { registerModuleAdministrationDestination } from "../../web/admin-navigation.js";
import { RAFFLE_ADMIN_CAPABILITY, raffleAuthorityCanAdminister } from "./authorization.js";

export function registerRaffleAdministrationDestination(): void {
  registerModuleAdministrationDestination({
    label: "Raffle",
    destination: "/admin/raffle",
    permissionScope: RAFFLE_ADMIN_CAPABILITY,
    authorized: raffleAuthorityCanAdminister,
  });
}
