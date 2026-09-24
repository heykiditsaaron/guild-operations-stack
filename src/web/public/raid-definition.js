for (const element of document.querySelectorAll("[data-raid-definition-start]")) {
  if (!(element instanceof HTMLInputElement)) continue;
  const unix = Number(element.dataset.raidDefinitionStart);
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  element.value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const form = document.querySelector("[data-raid-definition-form]");
const status = document.querySelector("[data-raid-definition-status]");
function setStatus(message) { if (status instanceof HTMLElement) status.textContent = message; }
function manageBasePath() { return window.location.pathname.replace(/\/definition\/?$/, ""); }

if (form instanceof HTMLFormElement) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const startsAt = String(data.get("startsAt") ?? "");
    const startDate = new Date(startsAt);
    if (!startsAt || !Number.isFinite(startDate.getTime())) { setStatus("Choose a valid raid start time."); return; }
    const requirements = [];
    const minimumItemLevel = String(data.get("minimumItemLevel") ?? "").trim();
    const enchantsAndGems = String(data.get("enchantsAndGems") ?? "").trim();
    if (minimumItemLevel) requirements.push({ label: "Minimum item level", value: minimumItemLevel });
    if (enchantsAndGems) requirements.push({ label: "Enchants & gems", value: enchantsAndGems });
    setStatus("Saving raid…");
    try {
      const response = await fetch(`${manageBasePath()}/definition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label:String(data.get("label")??""), description:String(data.get("description")??""), occursAt:[Math.floor(startDate.getTime()/1000)], difficulty:String(data.get("difficulty")??""), requirements }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Raid could not be saved");
      window.location.reload();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Raid could not be saved."); }
  });
}

const cancel = document.querySelector("[data-raid-cancel]");
if (cancel instanceof HTMLButtonElement) {
  cancel.addEventListener("click", async () => {
    if (!window.confirm("Cancel this raid? This permanently removes the raid, its participation, and its assignments.")) return;
    setStatus("Cancelling raid…");
    try {
      const response = await fetch(`${manageBasePath()}/cancel`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Raid could not be cancelled");
      window.location.assign("/activities/raid/manage");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Raid could not be cancelled."); }
  });
}
