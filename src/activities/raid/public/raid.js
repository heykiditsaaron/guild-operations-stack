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
  const empty = form.querySelector("[data-raid-specs-empty]");
  if (!(status instanceof HTMLElement)) continue;

  const poolInputs = [...form.querySelectorAll('input[name="pool-character"], input[name="pool-class"]')]
    .filter((input) => input instanceof HTMLInputElement);
  const specChoices = [...form.querySelectorAll("[data-raid-spec-choice]")]
    .filter((choice) => choice instanceof HTMLElement);

  function selectedPool() {
    const characters = poolInputs
      .filter((input) => input.name === "pool-character" && input.checked)
      .map((input) => ({
        className: input.dataset.className,
        character: {
          region: input.dataset.region,
          realmId: input.dataset.realmId,
          characterId: input.dataset.characterId,
        },
      }));
    const declaredClasses = poolInputs
      .filter((input) => input.name === "pool-class" && input.checked)
      .map((input) => input.value);
    return { characters, declaredClasses };
  }

  function refreshSpecs() {
    const { characters, declaredClasses } = selectedPool();
    const classes = new Set([
      ...characters.map((value) => value.className),
      ...declaredClasses,
    ]);
    for (const choice of specChoices) {
      const visible = classes.has(choice.dataset.className);
      choice.hidden = !visible;
      const input = choice.querySelector('input[name="spec"]');
      if (!visible && input instanceof HTMLInputElement) input.checked = false;
    }
    if (empty instanceof HTMLElement) empty.hidden = classes.size > 0;
  }

  for (const input of poolInputs) input.addEventListener("change", refreshSpecs);
  refreshSpecs();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { characters, declaredClasses } = selectedPool();
    const selectedSpecs = [...form.querySelectorAll('input[name="spec"]:checked')]
      .filter((input) => input instanceof HTMLInputElement);

    if (characters.length === 0 && declaredClasses.length === 0) {
      status.textContent = "Choose at least one character or class.";
      return;
    }
    if (selectedSpecs.length === 0) {
      status.textContent = "Choose at least one specialization.";
      return;
    }

    const offeredSpecs = selectedSpecs.map((input) => {
      const className = input.dataset.className;
      const character = characters.find((value) => value.className === className);
      return character
        ? { character: character.character, specName: input.value }
        : { className, specName: input.value };
    });

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
