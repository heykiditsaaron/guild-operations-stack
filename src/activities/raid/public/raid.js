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
  const acquisition = form.querySelector("[data-raid-acquisition]");
  const specStage = form.querySelector("[data-raid-spec-stage]");
  const sourceHeading = form.querySelector("[data-raid-source-heading]");
  const classHeading = form.querySelector("[data-raid-class-heading]");
  const contributionsElement = form.querySelector("[data-raid-offer-contributions]");
  const actions = form.querySelector("[data-raid-offer-actions]");
  if (!(status instanceof HTMLElement) || !(acquisition instanceof HTMLElement) || !(specStage instanceof HTMLElement) || !(contributionsElement instanceof HTMLElement) || !(actions instanceof HTMLElement)) continue;

  let pendingSource = null;
  const contributions = [];
  const existingSpecs = JSON.parse(form.dataset.existingSpecs || "[]");
  const existingByClass = new Map();
  for (const coordinate of existingSpecs) {
    const [className, specName] = coordinate.split("\\u0000");
    if (!className || !specName) continue;
    if (!existingByClass.has(className)) existingByClass.set(className, []);
    existingByClass.get(className).push(specName);
  }
  for (const [className, specs] of existingByClass) {
    contributions.push({ kind: "class", className, label: className, specs });
  }

  function renderContributions() {
    contributionsElement.replaceChildren();
    contributions.forEach((contribution, index) => {
      const card = document.createElement("article");
      card.className = "raid-contribution-card";
      const heading = document.createElement("div");
      heading.className = "raid-contribution-heading";
      const identity = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = contribution.label;
      const small = document.createElement("small");
      small.textContent = contribution.className;
      identity.append(strong, small);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button-secondary";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        contributions.splice(index, 1);
        renderContributions();
        if (!contributions.length) showAcquisition();
      });
      heading.append(identity, remove);
      const specs = document.createElement("div");
      specs.className = "raid-contribution-specs";
      for (const specName of contribution.specs) {
        const pill = document.createElement("span");
        pill.textContent = `${specName} ${contribution.className}`;
        specs.append(pill);
      }
      card.append(heading, specs);
      contributionsElement.append(card);
    });
    actions.hidden = contributions.length === 0;
  }

  function resetSpecStage() {
    pendingSource = null;
    specStage.hidden = true;
    const mode = form.querySelector("[data-raid-source-mode]");
    if (mode instanceof HTMLElement) mode.hidden = false;
    if (characterSelect instanceof HTMLElement) characterSelect.hidden = true;
    if (classSelect instanceof HTMLElement) classSelect.hidden = true;
    for (const template of form.querySelectorAll("[data-raid-spec-template]")) {
      if (!(template instanceof HTMLElement)) continue;
      template.hidden = true;
      const input = template.querySelector("input");
      if (input instanceof HTMLInputElement) input.checked = false;
    }
  }

  function showAcquisition() {
    acquisition.hidden = false;
    resetSpecStage();
  }

  const characterSelect = form.querySelector("[data-raid-character-select]");
  const classSelect = form.querySelector("[data-raid-class-select]");

  function chooseSource(source) {
    pendingSource = source;
    if (!pendingSource?.className) return;
    if (characterSelect instanceof HTMLElement) characterSelect.hidden = true;
    if (classSelect instanceof HTMLElement) classSelect.hidden = true;
    const mode = form.querySelector("[data-raid-source-mode]");
    if (mode instanceof HTMLElement) mode.hidden = true;
    specStage.hidden = false;
    if (sourceHeading instanceof HTMLElement) sourceHeading.textContent = pendingSource.label || "";
    if (classHeading instanceof HTMLElement) classHeading.textContent = pendingSource.className || "";
    for (const template of form.querySelectorAll("[data-raid-spec-template]")) {
      if (!(template instanceof HTMLElement)) continue;
      template.hidden = template.dataset.className !== pendingSource.className;
    }
  }

  for (const button of form.querySelectorAll("[data-raid-source-mode-choice]")) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.addEventListener("click", () => {
      if (characterSelect instanceof HTMLElement) characterSelect.hidden = button.dataset.raidSourceModeChoice !== "character";
      if (classSelect instanceof HTMLElement) classSelect.hidden = button.dataset.raidSourceModeChoice !== "class";
    });
  }

  const characterControl = characterSelect?.querySelector("select");
  if (characterControl instanceof HTMLSelectElement) characterControl.addEventListener("change", () => {
    const option = characterControl.selectedOptions[0];
    if (!option?.value) return;
    chooseSource({
      kind: "character",
      className: option.dataset.className,
      label: option.textContent?.split(" · ")[0] || "",
      character: { region: option.dataset.region, realmId: option.dataset.realmId, characterId: option.dataset.characterId },
    });
  });

  const classControl = classSelect?.querySelector("select");
  if (classControl instanceof HTMLSelectElement) classControl.addEventListener("change", () => {
    if (!classControl.value) return;
    chooseSource({ kind: "class", className: classControl.value, label: classControl.value, character: null });
  });

  form.querySelector("[data-raid-change-source]")?.addEventListener("click", resetSpecStage);
  form.querySelector("[data-raid-add-another]")?.addEventListener("click", showAcquisition);
  form.querySelector("[data-raid-add-contribution]")?.addEventListener("click", () => {
    if (!pendingSource?.className) return;
    const specs = [...form.querySelectorAll("[data-raid-spec-template] input:checked")]
      .filter((input) => input instanceof HTMLInputElement)
      .map((input) => input.value);
    if (!specs.length) {
      status.textContent = "Choose at least one specialization.";
      return;
    }
    contributions.push({ ...pendingSource, specs });
    status.textContent = "";
    renderContributions();
    acquisition.hidden = true;
  });

  renderContributions();
  if (contributions.length) acquisition.hidden = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const offeredSpecs = contributions.flatMap((contribution) =>
      contribution.specs.map((specName) => contribution.kind === "character"
        ? { character: contribution.character, specName }
        : { className: contribution.className, specName })
    );
    if (!offeredSpecs.length) {
      status.textContent = "Add at least one specialization to your offer.";
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
