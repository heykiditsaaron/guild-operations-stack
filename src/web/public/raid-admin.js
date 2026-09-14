for (const element of document.querySelectorAll("[data-unix-time]")) {
  const unix = Number(element.getAttribute("data-unix-time"));
  if (!Number.isFinite(unix)) continue;
  const date = new Date(unix * 1000);
  element.textContent = date.toLocaleString();
  if (element instanceof HTMLTimeElement) element.dateTime = date.toISOString();
}

const setup = document.querySelector("[data-raid-setup]");
const setupToggle = document.querySelector("[data-toggle-raid-setup]");
if (setup instanceof HTMLElement && setupToggle instanceof HTMLButtonElement) {
  setupToggle.addEventListener("click", () => {
    setup.hidden = !setup.hidden;
    setupToggle.textContent = setup.hidden ? "New raid" : "Close";
    if (!setup.hidden) setup.querySelector("input")?.focus();
  });
}

const createForm = document.querySelector("[data-raid-create-form]");
const createStatus = document.querySelector("[data-raid-create-status]");
if (createForm instanceof HTMLFormElement) {
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(createStatus instanceof HTMLElement)) return;
    const data = new FormData(createForm);
    const startsAt = String(data.get("startsAt") ?? "");
    const startDate = new Date(startsAt);
    if (!startsAt || !Number.isFinite(startDate.getTime())) {
      createStatus.textContent = "Choose a valid raid start time.";
      return;
    }
    createStatus.textContent = "Creating raid…";
    try {
      const response = await fetch("/admin/raid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(data.get("label") ?? ""),
          description: String(data.get("description") ?? ""),
          occursAt: [Math.floor(startDate.getTime() / 1000)],
          difficulty: String(data.get("difficulty") ?? ""),
          eligibility: String(data.get("eligibility") ?? ""),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Raid could not be created");
      window.location.href = `/admin/raid/${encodeURIComponent(payload.raid.raidId)}`;
    } catch (error) {
      createStatus.textContent = error instanceof Error ? error.message : "Raid could not be created.";
    }
  });
}

const actionStatus = document.querySelector("[data-raid-action-status]");
function setActionStatus(message) {
  if (actionStatus instanceof HTMLElement) actionStatus.textContent = message;
}

const signupsToggle = document.querySelector("[data-raid-signups-toggle]");
if (signupsToggle instanceof HTMLButtonElement) {
  signupsToggle.addEventListener("click", async () => {
    const open = signupsToggle.dataset.open === "true";
    setActionStatus(open ? "Opening signups…" : "Closing signups…");
    try {
      const response = await fetch(`${window.location.pathname}/signups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Signup state could not be changed");
      window.location.reload();
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Signup state could not be changed.");
    }
  });
}

async function assignParticipant(signupRowId, selectedSpec, selectedRole) {
  setActionStatus(`Assigning ${selectedSpec} ${selectedRole}…`);
  try {
    const response = await fetch(`${window.location.pathname}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupRowId, selectedSpec, selectedRole }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Participant could not be assigned");
    window.location.reload();
  } catch (error) {
    setActionStatus(error instanceof Error ? error.message : "Participant could not be assigned.");
  }
}

async function unassignParticipant(signupRowId) {
  setActionStatus("Returning participant to the pool…");
  try {
    const response = await fetch(`${window.location.pathname}/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupRowId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Participant could not be returned to the pool");
    window.location.reload();
  } catch (error) {
    setActionStatus(error instanceof Error ? error.message : "Participant could not be returned to the pool.");
  }
}

const specDialog = document.querySelector("[data-raid-spec-dialog]");
const specDialogCopy = document.querySelector("[data-raid-spec-dialog-copy]");
const specOptions = document.querySelector("[data-raid-spec-options]");
const specCancel = document.querySelector("[data-raid-spec-cancel]");

function chooseSpec(signupRowId, role, specs) {
  if (specs.length === 1) {
    void assignParticipant(signupRowId, specs[0], role);
    return;
  }
  if (!(specDialog instanceof HTMLDialogElement) || !(specOptions instanceof HTMLElement)) return;
  if (specDialogCopy instanceof HTMLElement) {
    specDialogCopy.textContent = `Choose the specialization to assign as ${role === "damage" ? "Damage" : role[0].toUpperCase() + role.slice(1)}.`;
  }
  specOptions.replaceChildren();
  for (const spec of specs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button-primary";
    button.textContent = spec;
    button.addEventListener("click", () => {
      specDialog.close();
      void assignParticipant(signupRowId, spec, role);
    });
    specOptions.append(button);
  }
  specDialog.showModal();
}

if (specCancel instanceof HTMLButtonElement && specDialog instanceof HTMLDialogElement) {
  specCancel.addEventListener("click", () => specDialog.close());
}

let selectedCard = null;
let pointerDrag = null;
let activeDropTarget = null;
const TOUCH_HOLD_MS = 400;
const TOUCH_CANCEL_DISTANCE = 10;

function participantRoleSpecs(card, role) {
  if (!(card instanceof HTMLElement)) return [];
  try {
    const parsed = JSON.parse(card.dataset.roleSpecs ?? "{}");
    const specs = parsed?.[role];
    return Array.isArray(specs) ? specs.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function roleForTarget(target) {
  if (!(target instanceof HTMLElement)) return null;
  const role = target.dataset.raidRoleDrop ?? target.dataset.raidDropRole;
  return role === "tank" || role === "healer" || role === "damage" ? role : null;
}

function clearDropState() {
  activeDropTarget = null;
  for (const target of document.querySelectorAll(".raid-drop-active, .raid-drop-available")) {
    target.classList.remove("raid-drop-active", "raid-drop-available");
  }
}

function showAvailableTargets(card) {
  clearDropState();
  for (const lane of document.querySelectorAll("[data-raid-role-drop]")) {
    const role = roleForTarget(lane);
    if (role && participantRoleSpecs(card, role).length) lane.classList.add("raid-drop-available");
  }
  const pool = document.querySelector("[data-raid-pool-drop]");
  if (pool instanceof HTMLElement && card.dataset.assigned === "true") pool.classList.add("raid-drop-available");
}

function clearSelectedCard() {
  if (selectedCard instanceof HTMLElement) selectedCard.classList.remove("raid-participant-card-selected");
  selectedCard = null;
  clearDropState();
}

function selectCard(card) {
  if (!(card instanceof HTMLElement)) return;
  if (selectedCard === card) {
    clearSelectedCard();
    setActionStatus("");
    return;
  }
  clearSelectedCard();
  selectedCard = card;
  card.classList.add("raid-participant-card-selected");
  showAvailableTargets(card);
  setActionStatus(card.dataset.assigned === "true"
    ? "Participant selected. Choose another + role, or tap the participation pool to return them."
    : "Participant selected. Choose a + role slot.");
}

function assignCardToRole(card, role) {
  if (!(card instanceof HTMLElement)) return;
  const signupRowId = card.dataset.signupRowId;
  if (!signupRowId) return;
  if (card.dataset.assigned === "true" && card.dataset.currentRole === role) {
    clearSelectedCard();
    setActionStatus("Participant is already assigned to that role.");
    return;
  }
  const specs = participantRoleSpecs(card, role);
  if (!specs.length) {
    setActionStatus(`That participation offer cannot be assigned as ${role === "damage" ? "Damage" : role}.`);
    return;
  }
  clearSelectedCard();
  chooseSpec(signupRowId, role, specs);
}

function targetAtPoint(card, x, y) {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element)) return null;
  const lane = element.closest("[data-raid-role-drop]");
  if (lane instanceof HTMLElement) {
    const role = roleForTarget(lane);
    if (role && participantRoleSpecs(card, role).length) return lane;
  }
  const pool = element.closest("[data-raid-pool-drop]");
  if (pool instanceof HTMLElement && card.dataset.assigned === "true") return pool;
  return null;
}

function markActiveTarget(target) {
  if (activeDropTarget === target) return;
  if (activeDropTarget instanceof HTMLElement) activeDropTarget.classList.remove("raid-drop-active");
  activeDropTarget = target;
  if (activeDropTarget instanceof HTMLElement) activeDropTarget.classList.add("raid-drop-active");
}

function startPointerDrag(state, event) {
  if (state.holdTimer) {
    clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }
  state.started = true;
  clearSelectedCard();
  state.card.classList.add("raid-participant-card-dragging");
  showAvailableTargets(state.card);
  if (!state.card.hasPointerCapture(state.pointerId)) state.card.setPointerCapture(state.pointerId);
  const rect = state.card.getBoundingClientRect();
  state.offsetX = event.clientX - rect.left;
  state.offsetY = event.clientY - rect.top;
  const ghost = state.card.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.removeAttribute("tabindex");
  ghost.classList.add("raid-drag-ghost");
  ghost.style.width = `${rect.width}px`;
  document.body.append(ghost);
  state.ghost = ghost;
  document.dispatchEvent(new CustomEvent("raid:dragstart", { detail: { card: state.card } }));
}

function positionPointerGhost(state, event) {
  if (!(state.ghost instanceof HTMLElement)) return;
  state.ghost.style.left = `${event.clientX - state.offsetX}px`;
  state.ghost.style.top = `${event.clientY - state.offsetY}px`;
}

function finishPointerDrag(state, event) {
  const target = targetAtPoint(state.card, event.clientX, event.clientY);
  state.ghost?.remove();
  state.card.classList.remove("raid-participant-card-dragging");
  clearDropState();
  document.dispatchEvent(new CustomEvent("raid:dragend", { detail: { card: state.card } }));
  if (!(target instanceof HTMLElement)) return;
  const role = roleForTarget(target);
  if (role) {
    assignCardToRole(state.card, role);
    return;
  }
  if (target.matches("[data-raid-pool-drop]") && state.card.dataset.assigned === "true") {
    const signupRowId = state.card.dataset.signupRowId;
    if (signupRowId) void unassignParticipant(signupRowId);
  }
}

function cancelPointerState(state) {
  if (state.holdTimer) clearTimeout(state.holdTimer);
  state.holdTimer = null;
}

for (const card of document.querySelectorAll("[data-raid-participant-card]")) {
  if (!(card instanceof HTMLElement)) continue;
  card.draggable = false;

  if (card.closest(".raid-signup-pool")) {
    card.addEventListener("selectstart", (event) => event.preventDefault());
    card.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  card.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const state = {
      card,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      started: false,
      cancelled: false,
      holdTimer: null,
      ghost: null,
      offsetX: 0,
      offsetY: 0,
    };
    pointerDrag = state;
    if (event.pointerType === "touch") {
      card.setPointerCapture(event.pointerId);
      state.holdTimer = window.setTimeout(() => {
        if (pointerDrag !== state || state.cancelled || state.started) return;
        startPointerDrag(state, { clientX: state.lastX, clientY: state.lastY });
        if (navigator.vibrate) navigator.vibrate(18);
      }, TOUCH_HOLD_MS);
      return;
    }
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    const state = pointerDrag;
    if (!state || state.card !== card || state.pointerId !== event.pointerId) return;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
    if (state.pointerType === "touch" && !state.started) {
      if (distance >= TOUCH_CANCEL_DISTANCE) {
        state.cancelled = true;
        cancelPointerState(state);
      }
      return;
    }
    if (!state.started && distance >= 7) startPointerDrag(state, event);
    if (!state.started) return;
    event.preventDefault();
    positionPointerGhost(state, event);
    markActiveTarget(targetAtPoint(card, event.clientX, event.clientY));
  });

  card.addEventListener("pointerup", (event) => {
    const state = pointerDrag;
    if (!state || state.card !== card || state.pointerId !== event.pointerId) return;
    pointerDrag = null;
    cancelPointerState(state);
    if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
    if (state.started) finishPointerDrag(state, event);
    else if (!state.cancelled) selectCard(card);
  });

  card.addEventListener("pointercancel", (event) => {
    const state = pointerDrag;
    if (!state || state.card !== card || state.pointerId !== event.pointerId) return;
    pointerDrag = null;
    cancelPointerState(state);
    state.ghost?.remove();
    card.classList.remove("raid-participant-card-dragging");
    clearDropState();
    if (state.started) document.dispatchEvent(new CustomEvent("raid:dragend", { detail: { card: state.card } }));
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectCard(card);
  });
}

for (const target of document.querySelectorAll("[data-raid-drop-role]")) {
  if (!(target instanceof HTMLButtonElement)) continue;
  const role = roleForTarget(target);
  if (!role) continue;
  target.addEventListener("click", () => {
    if (selectedCard instanceof HTMLElement) assignCardToRole(selectedCard, role);
    else setActionStatus("Select a participation card first, then choose a + role slot.");
  });
}

const poolDrop = document.querySelector("[data-raid-pool-drop]");
if (poolDrop instanceof HTMLElement) {
  poolDrop.addEventListener("click", (event) => {
    if (!(selectedCard instanceof HTMLElement) || selectedCard.dataset.assigned !== "true") return;
    if (event.target instanceof Element && event.target.closest("[data-raid-participant-card]")) return;
    const signupRowId = selectedCard.dataset.signupRowId;
    clearSelectedCard();
    if (signupRowId) void unassignParticipant(signupRowId);
  });
}