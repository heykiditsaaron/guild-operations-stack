const diagnosticRoot = document.querySelector("[data-raid-diagnostics]");
const scoreboard = document.querySelector(".raid-scoreboard");
const workspace = document.querySelector(".raid-workspace");

// The roster is the organizer's primary working object. Diagnostics describe the
// roster, so keep them immediately after the assignment workspace rather than
// between the event heading and the work itself.
if (scoreboard instanceof HTMLElement && workspace instanceof HTMLElement) {
  workspace.insertAdjacentElement("afterend", scoreboard);
}

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

  document.addEventListener("pointerdown", (event) => {
    if (poolPanel.dataset.open !== "true") return;
    if (!(event.target instanceof Node)) return;
    if (poolPanel.contains(event.target) || poolToggle.contains(event.target)) return;
    setPoolOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setPoolOpen(false);
  });

  let poolPointer = null;

  poolPanel.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;
    const card = event.target.closest("[data-raid-participant-card][data-assigned='false']");
    if (!(card instanceof HTMLElement)) return;
    poolPointer = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      collapsed: false,
    };
  }, true);

  window.addEventListener("pointermove", (event) => {
    if (!poolPointer || event.pointerId !== poolPointer.pointerId || poolPointer.collapsed) return;
    if (Math.hypot(event.clientX - poolPointer.startX, event.clientY - poolPointer.startY) < 7) return;
    poolPointer.collapsed = true;
    poolPanel.dataset.dragCollapsed = "true";
  }, true);

  function restorePoolAfterPointer(event) {
    if (!poolPointer || event.pointerId !== poolPointer.pointerId) return;
    const shouldRestore = poolPointer.collapsed;
    poolPointer = null;
    delete poolPanel.dataset.dragCollapsed;
    if (shouldRestore) setPoolOpen(true);
  }

  window.addEventListener("pointerup", restorePoolAfterPointer, true);
  window.addEventListener("pointercancel", restorePoolAfterPointer, true);
}
