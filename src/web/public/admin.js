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
