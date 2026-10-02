for (const form of document.querySelectorAll("[data-participation-offer-form]")) {
  if (!(form instanceof HTMLFormElement)) continue;
  const status = form.querySelector("[data-participation-offer-status]");
  const requests = [...form.querySelectorAll("[data-participation-request]")];

  for (const request of requests) {
    const character = request.querySelector("[data-participation-guild-character]");
    const currentCharacter = request.querySelector("[data-participation-current-character]");
    if (character instanceof HTMLSelectElement && currentCharacter instanceof HTMLScriptElement) {
      const current = JSON.parse(currentCharacter.textContent || "{}");
      character.value = JSON.stringify(current.value ?? {});
      character.dataset.participationRetainedValue = JSON.stringify(current);
    }

    const specWorkspace = request.querySelector("[data-participation-wow-spec]");
    if (!(specWorkspace instanceof HTMLElement)) continue;
    const characterSelect = specWorkspace.querySelector("[data-participation-spec-character]");
    const classSelect = specWorkspace.querySelector("[data-participation-spec-class]");
    const specSelect = specWorkspace.querySelector("[data-participation-spec-name]");
    const valuesElement = specWorkspace.querySelector("[data-participation-values]");
    const currentValues = specWorkspace.querySelector("[data-participation-current-values]");
    const add = specWorkspace.querySelector("[data-participation-add-value]");
    if (!(specSelect instanceof HTMLSelectElement) || !(valuesElement instanceof HTMLElement) || !(add instanceof HTMLButtonElement)) continue;

    const values = currentValues instanceof HTMLScriptElement ? JSON.parse(currentValues.textContent || "[]") : [];

    function selectedClass() {
      if (characterSelect instanceof HTMLSelectElement && characterSelect.value) {
        return characterSelect.selectedOptions[0]?.dataset.className || "";
      }
      return classSelect instanceof HTMLSelectElement ? classSelect.value : "";
    }

    function refreshSpecs() {
      const className = selectedClass();
      for (const option of specSelect.options) {
        option.hidden = Boolean(option.value) && option.dataset.className !== className;
      }
      specSelect.value = "";
      specSelect.disabled = !className;
    }

    function renderValues() {
      valuesElement.replaceChildren();
      values.forEach((value, index) => {
        const row = document.createElement("div");
        row.className = "participation-offer-workspace-value";
        const label = document.createElement("span");
        label.textContent = `${value.specName} ${value.className}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button-secondary";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          values.splice(index, 1);
          renderValues();
        });
        row.append(label, remove);
        valuesElement.append(row);
      });
    }

    characterSelect?.addEventListener("change", () => {
      if (characterSelect instanceof HTMLSelectElement && characterSelect.value && classSelect instanceof HTMLSelectElement) classSelect.value = "";
      refreshSpecs();
    });
    classSelect?.addEventListener("change", () => {
      if (classSelect instanceof HTMLSelectElement && classSelect.value && characterSelect instanceof HTMLSelectElement) characterSelect.value = "";
      refreshSpecs();
    });
    add.addEventListener("click", () => {
      const className = selectedClass();
      const specName = specSelect.value;
      if (!className || !specName) return;
      const character = characterSelect instanceof HTMLSelectElement && characterSelect.value
        ? JSON.parse(characterSelect.value)
        : null;
      values.push(character ? { character, className, specName } : { className, specName });
      renderValues();
    });
    specWorkspace._participationValues = values;
    renderValues();
    refreshSpecs();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const context = {};
    try {
      for (const request of requests) {
        const name = request.dataset.name;
        const kind = request.dataset.kind;
        const allowMultiple = request.dataset.allowMultiple === "true";
        if (!name) continue;
        let value;
        if (kind === "integer") {
          const input = request.querySelector("[data-participation-integer]");
          if (!(input instanceof HTMLInputElement) || !input.value) throw new Error(`${name} is required.`);
          const numberValue = Number(input.value);
          value = input.dataset.participationRetainedValue === input.value ? { retain: 0 } : numberValue;
        } else if (kind === "guild_character") {
          const input = request.querySelector("[data-participation-guild-character]");
          if (!(input instanceof HTMLSelectElement) || !input.value) throw new Error(`${name} is required.`);
          const selected = JSON.parse(input.value);
          const retained = input.dataset.participationRetainedValue
            ? JSON.parse(input.dataset.participationRetainedValue)
            : null;
          value = retained && JSON.stringify(retained.value) === JSON.stringify(selected)
            ? { retain: retained.retain }
            : selected;
        } else if (kind === "wow_spec") {
          const workspace = request.querySelector("[data-participation-wow-spec]");
          value = workspace?._participationValues ?? [];
          value = value.map(({ className, specName, character, retain }) =>
            Number.isSafeInteger(retain)
              ? { retain }
              : character ? { character, specName } : { className, specName }
          );
        }
        if (allowMultiple) {
          if (!Array.isArray(value) || value.length === 0) throw new Error(`${name} requires at least one value.`);
        } else if (Array.isArray(value)) {
          throw new Error(`${name} accepts one value.`);
        }
        context[name] = value;
      }

      if (status instanceof HTMLElement) status.textContent = "Submitting offer…";
      const response = await fetch(form.dataset.action || window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Participation offer could not be submitted.");
      window.location.reload();
    } catch (error) {
      if (status instanceof HTMLElement) status.textContent = error instanceof Error ? error.message : "Participation offer could not be submitted.";
    }
  });
}
