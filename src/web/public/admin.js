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
  const toggleLabel = scheduleEnabled.parentElement?.querySelector("span");
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
