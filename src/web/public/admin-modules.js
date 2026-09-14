for (const card of document.querySelectorAll("[data-module-lifecycle-card]")) {
  if (!(card instanceof HTMLElement)) continue;

  const moduleKey = card.dataset.moduleKey;
  const toggle = card.querySelector("[data-module-enabled]");
  const label = card.querySelector("[data-module-enabled-label]");
  const feedback = card.querySelector("[data-module-lifecycle-feedback]");

  if (
    !moduleKey
    || !(toggle instanceof HTMLInputElement)
    || !(label instanceof HTMLElement)
    || !(feedback instanceof HTMLElement)
  ) continue;

  toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    toggle.disabled = true;
    label.textContent = enabled ? "On" : "Off";
    feedback.textContent = enabled ? "Enabling module…" : "Disabling module…";

    try {
      const response = await fetch(`/admin/general/modules/${encodeURIComponent(moduleKey)}`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error(`Module update returned ${response.status}`);
      feedback.textContent = enabled ? "Module enabled." : "Module disabled.";
      window.location.reload();
    } catch (error) {
      console.error("Module enablement update failed", error);
      toggle.checked = !enabled;
      label.textContent = toggle.checked ? "On" : "Off";
      toggle.disabled = false;
      feedback.textContent = "Module state could not be updated.";
    }
  });
}
