for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

function raidMutationBase() {
  const suffix = "/participation";
  return window.location.pathname.endsWith(suffix)
    ? window.location.pathname.slice(0, -suffix.length)
    : window.location.pathname;
}

for (const form of document.querySelectorAll("[data-raid-signup-form]")) {
  if (!(form instanceof HTMLFormElement)) continue;
  const status = form.querySelector("[data-raid-signup-status]");
  if (!(status instanceof HTMLElement)) continue;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const offeredSpecs = [...form.querySelectorAll('input[name="spec"]:checked')]
      .filter((input) => input instanceof HTMLInputElement)
      .map((input) => ({
        character: {
          region: input.dataset.region,
          realmId: input.dataset.realmId,
          characterId: input.dataset.characterId,
        },
        specName: input.value,
      }));

    if (offeredSpecs.length === 0) {
      status.textContent = "Choose at least one specialization.";
      return;
    }

    status.textContent = "Submitting offer…";
    try {
      const response = await fetch(`${raidMutationBase()}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offeredSpecs }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Signup could not be submitted");
      window.location.reload();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Signup could not be submitted.";
    }
  });
}

for (const button of document.querySelectorAll("[data-raid-revoke-signup]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("click", async () => {
    const signupRowId = button.dataset.raidRevokeSignup;
    if (!signupRowId) return;
    button.disabled = true;
    button.textContent = "Withdrawing…";
    try {
      const response = await fetch(`${raidMutationBase()}/signup/${encodeURIComponent(signupRowId)}/withdraw`, { method: "POST" });
      const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Raid signup could not be withdrawn");
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Withdraw";
      window.alert(error instanceof Error ? error.message : "Raid signup could not be withdrawn.");
    }
  });
}
