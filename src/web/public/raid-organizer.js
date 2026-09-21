const diagnosticRoot = document.querySelector("[data-raid-diagnostics]");
function closeDiagnosticShelves() {
  if (!(diagnosticRoot instanceof HTMLElement)) return;
  for (const button of diagnosticRoot.querySelectorAll("[data-raid-shelf-toggle]")) {
    if (button instanceof HTMLButtonElement) button.setAttribute("aria-expanded", "false");
  }
  for (const panel of diagnosticRoot.querySelectorAll("[data-raid-shelf-panel]")) {
    if (panel instanceof HTMLElement) panel.dataset.open = "false";
  }
}

if (diagnosticRoot instanceof HTMLElement) {
  for (const button of diagnosticRoot.querySelectorAll("[data-raid-shelf-toggle]")) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.addEventListener("click", () => {
      const panelId = button.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      const opening = button.getAttribute("aria-expanded") !== "true";
      closeDiagnosticShelves();
      if (!opening || !(panel instanceof HTMLElement)) return;
      button.setAttribute("aria-expanded", "true");
      panel.dataset.open = "true";
    });
  }
  for (const button of diagnosticRoot.querySelectorAll("[data-raid-shelf-close]")) {
    if (button instanceof HTMLButtonElement) button.addEventListener("click", closeDiagnosticShelves);
  }
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node) || diagnosticRoot.contains(event.target)) return;
    closeDiagnosticShelves();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDiagnosticShelves();
  });
}

const poolPanel = document.querySelector("[data-raid-pool-panel]");
const poolToggle = document.querySelector("[data-raid-pool-toggle]");
const poolClose = document.querySelector("[data-raid-pool-close]");
const signupPool = document.querySelector(".raid-signup-pool[data-raid-pool-drop]");

function setPoolOpen(open) {
  if (!(poolPanel instanceof HTMLElement) || !(poolToggle instanceof HTMLButtonElement)) return;
  poolPanel.dataset.open = open ? "true" : "false";
  poolToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

if (poolPanel instanceof HTMLElement && poolToggle instanceof HTMLButtonElement) {
  poolToggle.addEventListener("click", () => {
    const selectedAssigned = document.querySelector("[data-raid-participant-card].raid-participant-card-selected[data-assigned='true']");
    if (selectedAssigned instanceof HTMLElement && signupPool instanceof HTMLElement) {
      signupPool.click();
      return;
    }
    setPoolOpen(poolToggle.getAttribute("aria-expanded") !== "true");
  });

  if (poolClose instanceof HTMLButtonElement) poolClose.addEventListener("click", () => setPoolOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setPoolOpen(false);
  });

  let poolDragCard = null;
  let poolCollapsedForDrag = false;
  document.addEventListener("raid:dragstart", (event) => {
    const card = event.detail?.card;
    if (!(card instanceof HTMLElement) || !poolPanel.contains(card)) return;
    poolDragCard = card;
  });

  document.addEventListener("pointermove", (event) => {
    if (!(poolDragCard instanceof HTMLElement) || poolCollapsedForDrag) return;
    if (!(event instanceof PointerEvent) || !event.isPrimary) return;
    poolCollapsedForDrag = true;
    poolPanel.dataset.dragCollapsed = "true";
  });

  document.addEventListener("raid:dragend", () => {
    poolDragCard = null;
    if (!poolCollapsedForDrag) return;
    poolCollapsedForDrag = false;
    delete poolPanel.dataset.dragCollapsed;
    setPoolOpen(true);
  });
}

for (const button of document.querySelectorAll("[data-raid-unassign]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const card = button.closest("[data-raid-participant-card]");
    if (!(card instanceof HTMLElement)) return;
    const signupRowId = card.dataset.signupRowId;
    if (!signupRowId) return;
    button.disabled = true;
    try {
      const response = await fetch(`${window.location.pathname}/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupRowId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Participant could not be returned to available participants");
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      const status = document.querySelector("[data-raid-action-status]");
      if (status instanceof HTMLElement) status.textContent = error instanceof Error ? error.message : "Participant could not be returned to available participants.";
    }
  });
}


for (const button of document.querySelectorAll("[data-raid-deny]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const card = button.closest("[data-raid-participant-card]");
    if (!(card instanceof HTMLElement)) return;
    const signupRowId = card.dataset.signupRowId;
    if (!signupRowId) return;
    button.disabled = true;
    try {
      const response = await fetch(`${window.location.pathname}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupRowId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Signup could not be denied");
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      const status = document.querySelector("[data-raid-action-status]");
      if (status instanceof HTMLElement) status.textContent = error instanceof Error ? error.message : "Signup could not be denied.";
    }
  });
}
