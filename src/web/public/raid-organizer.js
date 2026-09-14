const titleBar = document.querySelector(".raid-title-bar");
const workspaceHeading = document.querySelector(".raid-workspace-heading");
const adminActions = document.querySelector(".raid-admin-actions");
const editButton = titleBar?.querySelector(":scope > .button-secondary");
const organizerGrid = document.querySelector(".raid-organizer-grid");
const rosterDiagnostics = document.querySelector(".raid-roster-diagnostics");

if (titleBar instanceof HTMLElement && adminActions instanceof HTMLElement) {
  if (editButton instanceof HTMLElement) adminActions.prepend(editButton);
  titleBar.style.display = "grid";
  titleBar.style.gridTemplateColumns = "minmax(0, 1fr)";
  titleBar.style.alignItems = "start";
  adminActions.style.width = "100%";
  adminActions.style.paddingTop = "0.65rem";
  adminActions.style.borderTop = "1px solid rgba(255, 255, 255, 0.07)";
  titleBar.append(adminActions);
}

if (workspaceHeading instanceof HTMLElement) workspaceHeading.remove();

if (organizerGrid instanceof HTMLElement && rosterDiagnostics instanceof HTMLElement) {
  organizerGrid.insertAdjacentElement("beforebegin", rosterDiagnostics);
}

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

for (const button of document.querySelectorAll("[data-raid-unassign]")) {
  if (!(button instanceof HTMLButtonElement)) continue;

  button.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

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
