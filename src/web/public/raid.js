for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

for (const form of document.querySelectorAll("[data-raid-signup-form]")) {
  if (!(form instanceof HTMLFormElement)) continue;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-raid-signup-status]");
    if (!(status instanceof HTMLElement)) return;

    const specs = [...form.querySelectorAll('input[name="spec"]:checked')]
      .filter((input) => input instanceof HTMLInputElement)
      .map((input) => input.value);
    const roles = [...form.querySelectorAll('input[name="role"]:checked')]
      .filter((input) => input instanceof HTMLInputElement)
      .map((input) => input.value);

    if (specs.length === 0 || roles.length === 0) {
      status.textContent = "Choose at least one specialization and one role.";
      return;
    }

    status.textContent = "Submitting participation…";
    try {
      const response = await fetch(`${window.location.pathname}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: {
            region: form.dataset.region,
            realmId: form.dataset.realmId,
            characterId: form.dataset.characterId,
          },
          willingSpecs: specs,
          willingRoles: roles,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Participation could not be submitted");
      window.location.reload();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Participation could not be submitted.";
    }
  });
}
