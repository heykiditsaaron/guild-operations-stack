document.documentElement.dataset.webRenderer = "ready";

function closeOpenMenus() {
  document.querySelectorAll("details.menu-surface[open]").forEach((details) => {
    details.removeAttribute("open");
  });
}

function setMainPresentation(button) {
  const label = document.querySelector("[data-me-label]");
  const visual = document.querySelector("[data-me-visual]");
  if (!(label instanceof HTMLElement) || !(visual instanceof HTMLElement)) return;

  const name = button.dataset.characterName || "Me";
  const avatarUrl = button.dataset.avatarUrl || "";
  label.textContent = name;

  visual.replaceChildren();
  visual.classList.remove("account-visual-generic", "account-visual-portrait");
  if (avatarUrl) {
    const image = document.createElement("img");
    image.src = avatarUrl;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    visual.appendChild(image);
    visual.classList.add("account-visual-portrait");
  } else {
    const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    glyph.setAttribute("class", "account-glyph");
    glyph.setAttribute("viewBox", "0 0 24 24");
    glyph.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "4");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4.8 20c.8-4 3.2-6 7.2-6s6.4 2 7.2 6");
    glyph.append(circle, path);
    visual.appendChild(glyph);
    visual.classList.add("account-visual-generic");
  }
}

async function saveMain(button) {
  const picker = document.querySelector("[data-main-picker]");
  const status = document.querySelector("[data-main-picker-status]");
  const choices = document.querySelector("[data-character-choices]");
  if (!(picker instanceof HTMLDialogElement) || !(status instanceof HTMLElement) || !(choices instanceof HTMLElement)) return;

  const buttons = choices.querySelectorAll("[data-select-main]");
  buttons.forEach((candidate) => { candidate.disabled = true; });
  status.textContent = "Saving…";

  try {
    const response = await fetch("/me/main-character", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        realm_id: button.dataset.realmId,
        character_id: button.dataset.characterId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = result.error || "Unable to select main character.";
      return;
    }

    buttons.forEach((candidate) => {
      candidate.classList.remove("character-choice-current");
      const current = candidate.querySelector(".current-main-label");
      if (current) current.remove();
    });
    button.classList.add("character-choice-current");
    const name = button.querySelector(".character-choice-name");
    if (name instanceof HTMLElement) {
      const current = document.createElement("span");
      current.className = "current-main-label";
      current.textContent = "Current main";
      name.appendChild(current);
    }

    setMainPresentation(button);
    status.textContent = "";
    picker.close();
  } catch {
    status.textContent = "Unable to select main character.";
  } finally {
    buttons.forEach((candidate) => { candidate.disabled = false; });
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const logout = target.closest("[data-logout]");
  if (logout) {
    void fetch("/auth/logout", { method: "POST" }).then((response) => {
      if (response.ok) window.location.assign("/");
    });
    return;
  }

  const openPicker = target.closest("[data-open-main-picker]");
  if (openPicker) {
    closeOpenMenus();
    const picker = document.querySelector("[data-main-picker]");
    if (picker instanceof HTMLDialogElement) picker.showModal();
    return;
  }

  const closePicker = target.closest("[data-close-main-picker]");
  if (closePicker) {
    const picker = document.querySelector("[data-main-picker]");
    if (picker instanceof HTMLDialogElement) picker.close();
    return;
  }

  const selectMain = target.closest("[data-select-main]");
  if (selectMain instanceof HTMLButtonElement) {
    void saveMain(selectMain);
  }
});

document.addEventListener("click", (event) => {
  const picker = event.target;
  if (!(picker instanceof HTMLDialogElement) || !picker.matches("[data-main-picker]")) return;
  const rect = picker.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) picker.close();
});

document.addEventListener("toggle", (event) => {
  const opened = event.target;
  if (!(opened instanceof HTMLDetailsElement) || !opened.open) return;

  document.querySelectorAll("details.menu-surface[open]").forEach((details) => {
    if (details !== opened) details.removeAttribute("open");
  });
}, true);
