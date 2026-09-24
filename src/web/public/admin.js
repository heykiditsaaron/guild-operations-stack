for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;

  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

const refreshAdmin = document.querySelector("[data-guild-refresh-admin]");
const refreshButton = document.querySelector("[data-guild-refresh-button]");
const refreshFeedback = document.querySelector("[data-guild-refresh-feedback]");

if (
  refreshAdmin instanceof HTMLElement
  && refreshButton instanceof HTMLButtonElement
  && refreshFeedback instanceof HTMLElement
) {
  refreshButton.addEventListener("click", async () => {
    if (refreshButton.disabled) return;

    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing…";
    refreshFeedback.textContent = "Refreshing guild authority from Blizzard…";
    refreshAdmin.dataset.refreshState = "running";

    try {
      const response = await fetch("/guild/refresh", {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Guild refresh returned ${response.status}`);
      }

      refreshFeedback.textContent = "Guild refresh complete. Updating status…";
      refreshAdmin.dataset.refreshState = "success";
      window.location.reload();
    } catch (error) {
      console.error("Guild refresh failed", error);
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh now";
      refreshFeedback.textContent = "Guild refresh failed. View logs for details.";
      refreshAdmin.dataset.refreshState = "failure";
    }
  });
}

const scheduleForm = document.querySelector("[data-guild-refresh-schedule-form]");
const scheduleEnabled = document.querySelector("[data-guild-refresh-schedule-enabled]");
const scheduleInterval = document.querySelector("[data-guild-refresh-schedule-interval]");
const scheduleSave = document.querySelector("[data-guild-refresh-schedule-save]");
const scheduleFeedback = document.querySelector("[data-guild-refresh-schedule-feedback]");

if (
  scheduleForm instanceof HTMLFormElement
  && scheduleEnabled instanceof HTMLInputElement
  && scheduleInterval instanceof HTMLInputElement
  && scheduleSave instanceof HTMLButtonElement
  && scheduleFeedback instanceof HTMLElement
) {
  const toggleLabel = scheduleEnabled.parentElement?.querySelector("[data-switch-label]");
  scheduleEnabled.addEventListener("change", () => {
    if (toggleLabel) toggleLabel.textContent = scheduleEnabled.checked ? "On" : "Off";
  });

  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (scheduleSave.disabled) return;

    const intervalSeconds = Number(scheduleInterval.value);
    if (!Number.isInteger(intervalSeconds) || intervalSeconds < 300) {
      scheduleFeedback.textContent = "Automatic refresh interval must be at least 300 seconds.";
      return;
    }

    scheduleSave.disabled = true;
    scheduleSave.textContent = "Saving…";
    scheduleFeedback.textContent = "Saving automatic refresh settings…";

    try {
      const response = await fetch("/guild/refresh/schedule", {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: scheduleEnabled.checked,
          interval_seconds: intervalSeconds,
        }),
      });

      if (!response.ok) {
        throw new Error(`Guild refresh schedule update returned ${response.status}`);
      }

      scheduleFeedback.textContent = "Automatic refresh settings saved. Updating status…";
      window.location.reload();
    } catch (error) {
      console.error("Guild refresh schedule update failed", error);
      scheduleSave.disabled = false;
      scheduleSave.textContent = "Save";
      scheduleFeedback.textContent = "Automatic refresh settings could not be saved.";
    }
  });
}

const discordForm = document.querySelector("[data-discord-projection-form]");
const discordEnabled = document.querySelector("[data-discord-projection-enabled]");
const discordRefreshRoles = document.querySelector("[data-discord-refresh-roles]");
const discordSave = document.querySelector("[data-discord-projection-save]");
const discordFeedback = document.querySelector("[data-discord-projection-feedback]");

if (
  discordForm instanceof HTMLFormElement
  && discordEnabled instanceof HTMLInputElement
  && discordRefreshRoles instanceof HTMLButtonElement
  && discordSave instanceof HTMLButtonElement
  && discordFeedback instanceof HTMLElement
) {
  const toggleLabel = discordEnabled.parentElement?.querySelector("[data-discord-switch-label]");
  discordEnabled.addEventListener("change", () => {
    if (toggleLabel) toggleLabel.textContent = discordEnabled.checked ? "On" : "Off";
  });

  discordRefreshRoles.addEventListener("click", async () => {
    if (discordRefreshRoles.disabled) return;

    discordRefreshRoles.disabled = true;
    discordFeedback.textContent = "Refreshing Discord roles…";

    try {
      const response = await fetch("/admin", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
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
      .map((element) => ({
        rankIndex: Number(element.dataset.discordRankIndex),
        discordRoleId: element.value,
      }));

    discordSave.disabled = true;
    discordSave.textContent = "Saving…";
    discordFeedback.textContent = discordEnabled.checked
      ? "Saving Discord settings and reconciling roles…"
      : "Saving Discord settings…";

    try {
      const response = await fetch("/admin", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "discord_projection.update",
          enabled: discordEnabled.checked,
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

const themeForm = document.querySelector("[data-theme-settings-form]");
const themeSelect = document.querySelector("[data-theme-select]");
const themeSave = document.querySelector("[data-theme-save]");
const themeFeedback = document.querySelector("[data-theme-feedback]");

if (
  themeForm instanceof HTMLFormElement
  && themeSelect instanceof HTMLSelectElement
  && themeSave instanceof HTMLButtonElement
  && themeFeedback instanceof HTMLElement
) {
  themeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (themeSave.disabled) return;
    themeSave.disabled = true;
    themeSave.textContent = "Saving…";
    themeFeedback.textContent = "Saving guild theme…";
    try {
      const response = await fetch("/admin/general/theme", {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeSelect.value }),
      });
      if (!response.ok) throw new Error(`Theme update returned ${response.status}`);
      window.location.reload();
    } catch (error) {
      console.error("Guild theme update failed", error);
      themeSave.disabled = false;
      themeSave.textContent = "Save";
      themeFeedback.textContent = "Guild theme could not be saved.";
    }
  });
}


const guildPresentationForm = document.querySelector("[data-guild-presentation-form]");
const raiderIoUrl = document.querySelector("[data-raider-io-url]");
const warcraftLogsUrl = document.querySelector("[data-warcraft-logs-url]");
const guildPresentationSave = document.querySelector("[data-guild-presentation-save]");
const guildPresentationFeedback = document.querySelector("[data-guild-presentation-feedback]");

if (
  guildPresentationForm instanceof HTMLFormElement
  && raiderIoUrl instanceof HTMLInputElement
  && warcraftLogsUrl instanceof HTMLInputElement
  && guildPresentationSave instanceof HTMLButtonElement
  && guildPresentationFeedback instanceof HTMLElement
) {
  guildPresentationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (guildPresentationSave.disabled) return;
    guildPresentationSave.disabled = true;
    guildPresentationSave.textContent = "Saving…";
    guildPresentationFeedback.textContent = "Saving guild presentation…";
    try {
      const response = await fetch("/admin/general/presentation", {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          raiderIoUrl: raiderIoUrl.value.trim() || null,
          warcraftLogsUrl: warcraftLogsUrl.value.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(`Guild presentation update returned ${response.status}`);
      window.location.reload();
    } catch (error) {
      console.error("Guild presentation update failed", error);
      guildPresentationSave.disabled = false;
      guildPresentationSave.textContent = "Save";
      guildPresentationFeedback.textContent = "Guild presentation could not be saved. Use complete http or https URLs.";
    }
  });
}


const guildSettingsOrientation = document.querySelector("[data-guild-settings-location-acknowledged]");
const guildSettingsOrientationFeedback = document.querySelector("[data-guild-settings-orientation-feedback]");

if (
  guildSettingsOrientation instanceof HTMLInputElement
  && guildSettingsOrientationFeedback instanceof HTMLElement
) {
  guildSettingsOrientation.addEventListener("change", async () => {
    if (guildSettingsOrientation.disabled) return;
    const requested = guildSettingsOrientation.checked;
    guildSettingsOrientation.disabled = true;
    guildSettingsOrientationFeedback.textContent = "Updating Guild Settings guidance…";
    try {
      const response = await fetch("/admin/general/orientation", {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: requested }),
      });
      if (!response.ok) throw new Error(`Guild Settings orientation update returned ${response.status}`);
      window.location.reload();
    } catch (error) {
      console.error("Guild Settings orientation update failed", error);
      guildSettingsOrientation.checked = !requested;
      guildSettingsOrientation.disabled = false;
      guildSettingsOrientationFeedback.textContent = "Guild Settings guidance could not be updated.";
    }
  });
}
