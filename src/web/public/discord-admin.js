for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

const moduleForm = document.querySelector("[data-discord-module-form]");
if (moduleForm instanceof HTMLFormElement) {
  const clientId = moduleForm.querySelector("[data-discord-client-id]");
  const clientSecret = moduleForm.querySelector("[data-discord-client-secret]");
  const removeClientSecret = moduleForm.querySelector("[data-discord-client-secret-remove]");
  const guildId = moduleForm.querySelector("[data-discord-guild-id]");
  const botToken = moduleForm.querySelector("[data-discord-bot-token]");
  const removeBotToken = moduleForm.querySelector("[data-discord-bot-token-remove]");
  const inviteUrl = moduleForm.querySelector("[data-discord-invite-url]");
  const save = moduleForm.querySelector("[data-discord-module-save]");
  const feedback = moduleForm.querySelector("[data-discord-module-feedback]");

  moduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(clientId instanceof HTMLInputElement) || !(clientSecret instanceof HTMLInputElement) || !(removeClientSecret instanceof HTMLInputElement) || !(guildId instanceof HTMLInputElement) || !(botToken instanceof HTMLInputElement) || !(removeBotToken instanceof HTMLInputElement) || !(inviteUrl instanceof HTMLInputElement) || !(save instanceof HTMLButtonElement) || !(feedback instanceof HTMLElement)) return;

    save.disabled = true;
    feedback.textContent = "Saving Discord configuration…";
    try {
      const response = await fetch("/admin/discord", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discord_module.update",
          clientId: clientId.value,
          clientSecret: clientSecret.value || undefined,
          removeClientSecret: removeClientSecret.checked,
          discordGuildId: guildId.value,
          botToken: botToken.value || undefined,
          removeBotToken: removeBotToken.checked,
          inviteUrl: inviteUrl.value,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `Discord configuration update returned ${response.status}`);
      feedback.textContent = "Discord configuration saved. Updating status…";
      window.location.reload();
    } catch (error) {
      console.error("Discord configuration update failed", error);
      feedback.textContent = error instanceof Error ? error.message : "Discord configuration could not be saved.";
      save.disabled = false;
    }
  });
}

const discordForm = document.querySelector("[data-discord-projection-form]");
const linkedMappingEnabled = document.querySelector("[data-discord-linked-mapping-enabled]");
const rankMappingEnabled = document.querySelector("[data-discord-rank-mapping-enabled]");
const discordRefreshRoles = document.querySelector("[data-discord-refresh-roles]");
const discordSave = document.querySelector("[data-discord-projection-save]");
const discordFeedback = document.querySelector("[data-discord-projection-feedback]");

if (discordForm instanceof HTMLFormElement && linkedMappingEnabled instanceof HTMLInputElement && rankMappingEnabled instanceof HTMLInputElement && discordRefreshRoles instanceof HTMLButtonElement && discordSave instanceof HTMLButtonElement && discordFeedback instanceof HTMLElement) {
  const linkedToggleLabel = linkedMappingEnabled.parentElement?.querySelector("[data-discord-linked-switch-label]");
  const rankToggleLabel = rankMappingEnabled.parentElement?.querySelector("[data-discord-rank-switch-label]");
  linkedMappingEnabled.addEventListener("change", () => { if (linkedToggleLabel) linkedToggleLabel.textContent = linkedMappingEnabled.checked ? "On" : "Off"; });
  rankMappingEnabled.addEventListener("change", () => { if (rankToggleLabel) rankToggleLabel.textContent = rankMappingEnabled.checked ? "On" : "Off"; });

  discordRefreshRoles.addEventListener("click", async () => {
    if (discordRefreshRoles.disabled) return;
    discordRefreshRoles.disabled = true;
    discordFeedback.textContent = "Refreshing Discord roles…";
    try {
      const response = await fetch("/admin/discord", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discord_roles.refresh" }),
      });
      if (!response.ok) throw new Error(`Discord role refresh returned ${response.status}`);
      const payload = await response.json();
      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      for (const element of discordForm.querySelectorAll("[data-discord-role-select]")) {
        if (!(element instanceof HTMLSelectElement)) continue;
        const selected = element.value;
        element.replaceChildren();
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "Not configured";
        element.append(empty);
        for (const role of roles) {
          if (!role || typeof role.id !== "string" || typeof role.name !== "string") continue;
          const option = document.createElement("option");
          option.value = role.id;
          option.textContent = role.name;
          option.selected = role.id === selected;
          element.append(option);
        }
        if (!roles.some((role) => role?.id === selected)) element.value = "";
      }
      discordFeedback.textContent = "Discord roles refreshed. Unsaved selections were preserved where possible.";
    } catch (error) {
      console.error("Discord role refresh failed", error);
      discordFeedback.textContent = "Discord roles could not be refreshed.";
    } finally {
      discordRefreshRoles.disabled = false;
    }
  });

  discordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (discordSave.disabled) return;
    const linkedRole = discordForm.querySelector('select[name="linkedRoleId"]');
    if (!(linkedRole instanceof HTMLSelectElement)) return;
    const rankRoles = Array.from(discordForm.querySelectorAll("[data-discord-rank-index]"))
      .filter((element) => element instanceof HTMLSelectElement && element.value)
      .map((element) => ({ rankIndex: Number(element.dataset.discordRankIndex), discordRoleId: element.value }));

    discordSave.disabled = true;
    discordSave.textContent = "Saving…";
    discordFeedback.textContent = linkedMappingEnabled.checked || rankMappingEnabled.checked
      ? "Saving Discord settings and reconciling enabled role maps…"
      : "Saving Discord settings…";
    try {
      const response = await fetch("/admin/discord", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discord_projection.update",
          linkedMappingEnabled: linkedMappingEnabled.checked,
          rankMappingEnabled: rankMappingEnabled.checked,
          linkedRoleId: linkedRole.value || null,
          rankRoles,
        }),
      });
      if (!response.ok) {
        if (response.status === 502) {
          discordFeedback.textContent = "Settings were saved, but Discord reconciliation failed. View logs for details.";
          discordSave.disabled = false;
          discordSave.textContent = "Save";
          return;
        }
        throw new Error(`Discord projection update returned ${response.status}`);
      }
      discordFeedback.textContent = "Discord settings saved. Updating status…";
      window.location.reload();
    } catch (error) {
      console.error("Discord projection update failed", error);
      discordSave.disabled = false;
      discordSave.textContent = "Save";
      discordFeedback.textContent = "Discord settings could not be saved.";
    }
  });
}
