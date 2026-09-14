for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

const createForm = document.querySelector("[data-raid-create-form]");
const createStatus = document.querySelector("[data-raid-create-status]");

if (createForm instanceof HTMLFormElement) {
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(createStatus instanceof HTMLElement)) return;

    const data = new FormData(createForm);
    const startsAt = String(data.get("startsAt") ?? "");
    const startDate = new Date(startsAt);
    const raidSize = Number(data.get("raidSize"));

    if (!startsAt || !Number.isFinite(startDate.getTime())) {
      createStatus.textContent = "Choose a valid raid start time.";
      return;
    }

    createStatus.textContent = "Creating raid…";

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

      window.location.href = `/admin/raid/${encodeURIComponent(payload.raid.raidId)}`;
    } catch (error) {
      createStatus.textContent = error instanceof Error ? error.message : "Raid could not be created.";
    }
  });
}

const signupsToggle = document.querySelector("[data-raid-signups-toggle]");
if (signupsToggle instanceof HTMLButtonElement) {
  signupsToggle.addEventListener("click", async () => {
    const open = signupsToggle.dataset.open === "true";
    const status = document.querySelector("[data-raid-action-status]");
    if (status instanceof HTMLElement) status.textContent = open ? "Opening signups…" : "Closing signups…";
    try {
      const response = await fetch(`${window.location.pathname}/signups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Signup state could not be changed");
      window.location.reload();
    } catch (error) {
      if (status instanceof HTMLElement) status.textContent = error instanceof Error ? error.message : "Signup state could not be changed.";
    }
  });
}

for (const form of document.querySelectorAll("[data-raid-assign]")) {
  if (!(form instanceof HTMLFormElement)) continue;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-raid-action-status]");
    const data = new FormData(form);
    if (status instanceof HTMLElement) status.textContent = "Assigning…";
    try {
      const response = await fetch(`${window.location.pathname}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupRowId: form.dataset.signupRowId,
          slotIndex: Number(data.get("slotIndex")),
          selectedSpec: String(data.get("selectedSpec") ?? ""),
          selectedRole: String(data.get("selectedRole") ?? ""),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Participant could not be assigned");
      window.location.reload();
    } catch (error) {
      if (status instanceof HTMLElement) status.textContent = error instanceof Error ? error.message : "Participant could not be assigned.";
    }
  });
}

for (const button of document.querySelectorAll("[data-raid-unassign]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("click", async () => {
    const slotIndex = Number(button.dataset.slotIndex);
    try {
      const response = await fetch(`${window.location.pathname}/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIndex }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Participant could not be unassigned");
      window.location.reload();
    } catch (error) {
      const status = document.querySelector("[data-raid-action-status]");
      if (status instanceof HTMLElement) status.textContent = error instanceof Error ? error.message : "Participant could not be unassigned.";
    }
  });
}
