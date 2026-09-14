const form = document.querySelector("[data-raid-permissions-form]");
const status = document.querySelector("[data-raid-permissions-status]");

if (form instanceof HTMLFormElement) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    if (status) status.textContent = "Saving…";

    const updates = [...form.querySelectorAll("[data-raid-permission-rank]")].map((row) => ({
      rankIndex: Number(row.getAttribute("data-rank-index")),
      canCreate: row.querySelector("[data-raid-permission-create]")?.checked === true,
      canManage: row.querySelector("[data-raid-permission-manage]")?.checked === true,
    }));

    try {
      const response = await fetch("/admin/permissions/raid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Raid permissions could not be saved");
      if (status) status.textContent = "Raid permissions saved.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Raid permissions could not be saved.";
    } finally {
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });
}
