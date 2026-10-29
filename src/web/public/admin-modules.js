for (const card of document.querySelectorAll("[data-module-key]")) {
  if (!(card instanceof HTMLElement)) continue;

  const moduleKey = card.dataset.moduleKey;
  const toggle = card.querySelector("[data-module-enabled]");
  const label = card.querySelector("[data-module-switch-label]");
  const feedback = card.querySelector("[data-module-feedback]");

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
      const response = await fetch(`/admin/modules/${encodeURIComponent(moduleKey)}`, {
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


for (const card of document.querySelectorAll("[data-activity-key]")) {
  const kind = card.dataset.activityKey;
  const toggle = card.querySelector("[data-activity-enabled]");
  const label = card.querySelector("[data-activity-switch-label]");
  const feedback = card.querySelector("[data-activity-feedback]");
  const save = card.querySelector("[data-activity-save]");
  const form = card.querySelector("[data-activity-publication-form]");
  const channel = form?.querySelector('select[name="channel_id"]');
  if (!kind || !toggle || !label || !feedback || !save) continue;
  let savedEnabled = toggle.checked;
  let savedChannel = channel?.value;
  let busy = false;
  const refresh = () => {
    label.textContent = toggle.checked ? "On" : "Off";
    save.disabled = busy || (toggle.checked === savedEnabled && (!channel || channel.value === savedChannel));
  };
  toggle.addEventListener("change", refresh);
  channel?.addEventListener("change", refresh);
  form?.addEventListener("submit", event => { event.preventDefault(); save.click(); });
  save.addEventListener("click", async () => {
    if (busy || save.disabled) return;
    busy = true;
    refresh();
    feedback.textContent = "Saving…";
    const failures = [];
    let completed = 0;
    if (toggle.checked !== savedEnabled) {
      try {
        const response = await fetch(`/admin/activities/${encodeURIComponent(kind)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: toggle.checked })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        savedEnabled = toggle.checked;
        completed++;
      } catch (error) { failures.push(`Activity enablement: ${error.message}`); }
    }
    if (channel && channel.value !== savedChannel) {
      try {
        const response = await fetch(form.action, {
          method: "POST", body: new URLSearchParams(new FormData(form)), redirect: "manual"
        });
        if (!response.ok && response.type !== "opaqueredirect" && response.status !== 302 && response.status !== 303) {
          throw new Error(`HTTP ${response.status}`);
        }
        savedChannel = channel.value;
        completed++;
      } catch (error) { failures.push(`Discord publication: ${error.message}`); }
    }
    feedback.textContent = failures.length ? `Some changes were not saved. ${failures.join("; ")}` : completed ? "Changes saved." : "No changes saved.";
    busy = false;
    refresh();
  });
  refresh();
}
