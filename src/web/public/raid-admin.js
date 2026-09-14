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
  setActionStatus("Unassigning participant…");
  try {
    const response = await fetch(`${window.location.pathname}/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupRowId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Participant could not be unassigned");
    window.location.reload();
  } catch (error) {
    setActionStatus(error instanceof Error ? error.message : "Participant could not be unassigned.");
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
let draggedCard = null;

function clearSelectedCard() {
  if (selectedCard instanceof HTMLElement) selectedCard.classList.remove("raid-participant-card-selected");
  selectedCard = null;
}

function selectCard(card) {
  clearSelectedCard();
  if (!(card instanceof HTMLElement)) return;
  selectedCard = card;
  card.classList.add("raid-participant-card-selected");
  setActionStatus("Participant selected. Choose a + role slot.");
}

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

function assignCardToRole(card, role) {
  if (!(card instanceof HTMLElement)) return;
  const signupRowId = card.dataset.signupRowId;
  if (!signupRowId) return;
  const specs = participantRoleSpecs(card, role);
  if (!specs.length) {
    setActionStatus(`That participation offer cannot be assigned as ${role === "damage" ? "Damage" : role}.`);
    return;
  }
  clearSelectedCard();
  chooseSpec(signupRowId, role, specs);
}

for (const card of document.querySelectorAll("[data-raid-participant-card]")) {
  if (!(card instanceof HTMLElement)) continue;
  card.addEventListener("click", () => selectCard(card));
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectCard(card);
  });
  card.addEventListener("dragstart", (event) => {
    draggedCard = card;
    clearSelectedCard();
    card.classList.add("raid-participant-card-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.signupRowId ?? "");
    }
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("raid-participant-card-dragging");
    draggedCard = null;
    for (const target of document.querySelectorAll(".raid-drop-active")) target.classList.remove("raid-drop-active");
  });
}

for (const target of document.querySelectorAll("[data-raid-drop-role]")) {
  if (!(target instanceof HTMLButtonElement)) continue;
  const role = target.dataset.raidDropRole;
  if (role !== "tank" && role !== "healer" && role !== "damage") continue;

  target.addEventListener("click", () => {
    if (selectedCard instanceof HTMLElement) assignCardToRole(selectedCard, role);
    else setActionStatus("Select a participation card first, then choose a + role slot.");
  });
  target.addEventListener("dragover", (event) => {
    if (!(draggedCard instanceof HTMLElement) || !draggedCard.matches("[data-raid-participant-card]")) return;
    event.preventDefault();
    target.classList.add("raid-drop-active");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  target.addEventListener("dragleave", () => target.classList.remove("raid-drop-active"));
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    target.classList.remove("raid-drop-active");
    if (draggedCard instanceof HTMLElement && draggedCard.matches("[data-raid-participant-card]")) assignCardToRole(draggedCard, role);
  });
}

for (const card of document.querySelectorAll("[data-raid-assigned-card]")) {
  if (!(card instanceof HTMLElement)) continue;
  card.addEventListener("dragstart", (event) => {
    draggedCard = card;
    card.classList.add("raid-participant-card-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.signupRowId ?? "");
    }
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("raid-participant-card-dragging");
    draggedCard = null;
  });
}

const poolDrop = document.querySelector("[data-raid-pool-drop]");
if (poolDrop instanceof HTMLElement) {
  poolDrop.addEventListener("dragover", (event) => {
    if (!(draggedCard instanceof HTMLElement) || !draggedCard.matches("[data-raid-assigned-card]")) return;
    event.preventDefault();
    poolDrop.classList.add("raid-drop-active");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  poolDrop.addEventListener("dragleave", () => poolDrop.classList.remove("raid-drop-active"));
  poolDrop.addEventListener("drop", (event) => {
    event.preventDefault();
    poolDrop.classList.remove("raid-drop-active");
    if (!(draggedCard instanceof HTMLElement) || !draggedCard.matches("[data-raid-assigned-card]")) return;
    const signupRowId = draggedCard.dataset.signupRowId;
    if (signupRowId) void unassignParticipant(signupRowId);
  });
}

for (const button of document.querySelectorAll("[data-raid-unassign]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const signupRowId = button.dataset.signupRowId;
    if (signupRowId) void unassignParticipant(signupRowId);
  });
}
