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

const raidDragDebugEnabled = new URLSearchParams(window.location.search).get("raidDragDebug") === "1";

if (raidDragDebugEnabled) {
  const debugPanel = document.createElement("aside");
  debugPanel.setAttribute("aria-label", "Raid drag debug log");
  debugPanel.style.position = "fixed";
  debugPanel.style.zIndex = "9999";
  debugPanel.style.left = ".45rem";
  debugPanel.style.right = ".45rem";
  debugPanel.style.top = ".45rem";
  debugPanel.style.maxHeight = "36vh";
  debugPanel.style.overflow = "auto";
  debugPanel.style.padding = ".55rem";
  debugPanel.style.border = "1px solid rgba(255,255,255,.35)";
  debugPanel.style.borderRadius = ".55rem";
  debugPanel.style.background = "rgba(0,0,0,.92)";
  debugPanel.style.color = "#fff";
  debugPanel.style.font = "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace";
  debugPanel.style.whiteSpace = "pre-wrap";
  debugPanel.style.pointerEvents = "none";
  document.body.append(debugPanel);

  const startedAt = performance.now();
  const entries = [];
  const describeTarget = (target) => {
    if (!(target instanceof Element)) return String(target);
    const card = target.closest("[data-raid-participant-card]");
    if (card instanceof HTMLElement) {
      const label = card.querySelector("strong")?.textContent?.trim() ?? "card";
      return `card:${label}`;
    }
    if (target.closest("[data-raid-pool-panel]")) return "pool-panel";
    if (target.closest("[data-raid-role-drop]")) return `role:${target.closest("[data-raid-role-drop]")?.getAttribute("data-raid-role-drop") ?? "?"}`;
    return target.tagName.toLowerCase();
  };
  const writeDebug = (message) => {
    const elapsed = Math.round(performance.now() - startedAt);
    entries.push(`${String(elapsed).padStart(5, " ")}ms  ${message}`);
    if (entries.length > 24) entries.shift();
    debugPanel.textContent = entries.join("\n");
    debugPanel.scrollTop = debugPanel.scrollHeight;
  };

  const pointerSummary = (event) => {
    const target = describeTarget(event.target);
    const captured = event.target instanceof Element && typeof event.target.hasPointerCapture === "function"
      ? event.target.hasPointerCapture(event.pointerId)
      : false;
    return `${event.type} ${event.pointerType || ""} id=${event.pointerId ?? "-"} target=${target} prevented=${event.defaultPrevented} captured=${captured}`;
  };

  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture"]) {
    document.addEventListener(type, (event) => {
      if (!(event instanceof PointerEvent)) return;
      if (type === "pointermove" && !event.buttons) return;
      writeDebug(pointerSummary(event));
    }, true);
  }

  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel", "contextmenu", "selectstart"]) {
    document.addEventListener(type, (event) => {
      writeDebug(`${type} target=${describeTarget(event.target)} prevented=${event.defaultPrevented}`);
    }, true);
  }

  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    writeDebug(`selectionchange text=${JSON.stringify(text.slice(0, 32))}`);
  }, true);

  document.addEventListener("raid:dragstart", (event) => {
    writeDebug(`raid:dragstart target=${describeTarget(event.detail?.card ?? null)} poolCollapsed=${poolPanel instanceof HTMLElement ? poolPanel.dataset.dragCollapsed ?? "false" : "n/a"}`);
  });

  document.addEventListener("raid:dragend", (event) => {
    writeDebug(`raid:dragend target=${describeTarget(event.detail?.card ?? null)} poolCollapsed=${poolPanel instanceof HTMLElement ? poolPanel.dataset.dragCollapsed ?? "false" : "n/a"}`);
  });

  writeDebug("raid drag diagnostics enabled");
}
