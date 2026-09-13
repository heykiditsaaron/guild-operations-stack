const form = document.querySelector("[data-raid-create-form]");
const status = document.querySelector("[data-raid-create-status]");

if (form instanceof HTMLFormElement) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(status instanceof HTMLElement)) return;

    const data = new FormData(form);
    const startsAt = String(data.get("startsAt") ?? "");
    const startDate = new Date(startsAt);
    const raidSize = Number(data.get("raidSize"));

    if (!startsAt || !Number.isFinite(startDate.getTime())) {
      status.textContent = "Choose a valid raid start time.";
      return;
    }

    status.textContent = "Creating raid…";

    try {
      const response = await fetch("/admin/raid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(data.get("label") ?? ""),
          description: String(data.get("description") ?? ""),
          occursAt: [Math.floor(startDate.getTime() / 1000)],
          eligibility: String(data.get("eligibility") ?? ""),
          raidSize,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Raid could not be created");

      window.location.reload();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Raid could not be created.";
    }
  });
}
