document.querySelector("form[data-setup-blizzard]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitSetup(event.currentTarget, "/installation/blizzard");
});
async function submitSetup(form, endpoint) {
  const button = form.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  const body = Object.fromEntries(new FormData(form).entries());
  const setupToken = body.setup_token;
  delete body.setup_token;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json", ...(setupToken ? { "x-setup-authorization": setupToken } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Setup action failed");
    window.location.assign(endpoint.endsWith("/authorize") ? "/" : "/setup");
  } catch {
    const status = document.querySelector("[data-setup-status]");
    if (status) status.textContent = "That step could not be completed. Please try again.";
    if (button) button.disabled = false;
  }
}
document.querySelectorAll("form[data-setup-guild]").forEach((form) => form.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitSetup(form, "/installation/guild");
}));
document.querySelector("form[data-setup-authorize]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitSetup(event.currentTarget, "/installation/authorize");
});

document.querySelector("form[data-setup-signout]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/auth/logout", {
      method: "POST",
      headers: { "accept": "application/json" },
    });
    if (!response.ok) throw new Error("Sign out failed");
    window.location.assign("/setup");
  } catch {
    const status = document.querySelector("[data-setup-status]");
    if (status) status.textContent = "Sign out could not be completed. Please try again.";
    if (button) button.disabled = false;
  }
});


document.querySelectorAll("[data-copy-value]").forEach((button) => button.addEventListener("click", async () => {
  const value = button.dataset.copyValue;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    button.classList.add("setup-copy-action-copied");
    button.setAttribute("aria-label", "Copied");
    button.setAttribute("title", "Copied");
    window.setTimeout(() => {
      button.classList.remove("setup-copy-action-copied");
      button.setAttribute("aria-label", "Copy callback URL");
      button.setAttribute("title", "Copy callback URL");
    }, 1500);
  } catch {
    const status = document.querySelector("[data-setup-status]");
    if (status) status.textContent = "Copy failed. Select the value and copy it manually.";
  }
}));


document.querySelector("[data-setup-restart]")?.addEventListener("click", async () => {
  const confirmed = window.confirm("Restart setup? This clears the incomplete guild binding, Blizzard application configuration, and current setup sessions. Guild Operations will return to the beginning of first-run setup.");
  if (!confirmed) return;
  const setupToken = window.prompt("Enter the setup authorization token from the installation host to restart setup:");
  if (!setupToken) return;
  const button = document.querySelector("[data-setup-restart]");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/installation/restart", {
      method: "POST",
      headers: { "accept": "application/json", "x-setup-authorization": setupToken },
    });
    if (!response.ok) throw new Error("Restart failed");
    window.location.assign("/setup");
  } catch {
    const status = document.querySelector("[data-setup-status]");
    if (status) status.textContent = "Setup could not be restarted. Please try again.";
    if (button) button.disabled = false;
  }
});
