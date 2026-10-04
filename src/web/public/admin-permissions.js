for (const form of document.querySelectorAll("[data-permission-form]")) {
  if (!(form instanceof HTMLFormElement)) continue;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const capability = form.closest("[data-permission-capability]");
    if (!(capability instanceof HTMLElement)) return;
    const key = capability.dataset.permissionCapability;
    if (!key) return;
    const submit = form.querySelector('button[type="submit"]');
    const status = form.querySelector("[data-permission-status]");
    const summary = capability.querySelector("[data-permission-summary]");
    const selected = [...form.querySelectorAll('input[type="checkbox"]:checked')];
    const permittedRanks = selected.map((input) => Number(input.value));
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    if (status) status.textContent = "Saving…";
    try {
      const response = await fetch(`/admin/permissions/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permittedRanks }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Permission could not be saved");
      if (summary) {
        const names = selected.map((input) => input.closest("label")?.querySelector("strong")?.textContent ?? `Rank ${input.value}`);
        const effectiveNames = ["Guild Master", ...names];
        summary.textContent = effectiveNames.length <= 3 ? effectiveNames.join(", ") : `${effectiveNames.slice(0, 2).join(", ")} + ${effectiveNames.length - 2} more`;
      }
      if (status) status.textContent = "Saved.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Permission could not be saved.";
    } finally {
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });
}
