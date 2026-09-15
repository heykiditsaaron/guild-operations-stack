for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

function decodedList(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value ?? ""));
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function renderChoices(container, name, values) {
  container.querySelectorAll("label").forEach((label) => label.remove());
  for (const value of values) {
    const label = document.createElement("label");
    label.className = "raid-offer-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    container.append(label);
  }
}

for (const form of document.querySelectorAll("[data-raid-signup-form]")) {
  if (!(form instanceof HTMLFormElement)) continue;

  const selector = form.querySelector("[data-raid-participation-choice]");
  const editor = form.querySelector("[data-raid-offer-editor]");
  const specsFieldset = form.querySelector("[data-raid-specs]");
  const status = form.querySelector("[data-raid-signup-status]");

  if (
    !(selector instanceof HTMLSelectElement)
    || !(editor instanceof HTMLElement)
    || !(specsFieldset instanceof HTMLFieldSetElement)
    || !(status instanceof HTMLElement)
  ) continue;

  const refreshEditor = () => {
    const option = selector.selectedOptions[0];
    if (!(option instanceof HTMLOptionElement) || !option.value) {
      editor.hidden = true;
      return;
    }

    renderChoices(specsFieldset, "spec", decodedList(option.dataset.specs));
    status.textContent = "";
    editor.hidden = false;
  };

  selector.addEventListener("change", refreshEditor);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const option = selector.selectedOptions[0];
    if (!(option instanceof HTMLOptionElement) || !option.value) {
      status.textContent = "Choose a character or class first.";
      return;
    }

    const specs = [...form.querySelectorAll('input[name="spec"]:checked')]
      .filter((input) => input instanceof HTMLInputElement)
      .map((input) => input.value);

    if (specs.length === 0) {
      status.textContent = "Choose at least one specialization.";
      return;
    }

    const body = { willingSpecs: specs };

    if (option.dataset.kind === "class") {
      body.declaredClass = option.dataset.className;
    } else {
      body.character = {
        region: option.dataset.region,
        realmId: option.dataset.realmId,
        characterId: option.dataset.characterId,
      };
    }

    status.textContent = "Submitting participation…";
    try {
      const response = await fetch(`${window.location.pathname}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Participation could not be submitted");
      window.location.reload();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Participation could not be submitted.";
    }
  });
}
