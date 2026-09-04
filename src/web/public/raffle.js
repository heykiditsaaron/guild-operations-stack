function formatRaffleAdminBreadcrumb() {
  const breadcrumbTime = document.querySelector('nav[aria-label="Administrative breadcrumb"] time[data-local-time-unix]');
  if (!(breadcrumbTime instanceof HTMLTimeElement)) return;

  const unixSeconds = Number(breadcrumbTime.dataset.localTimeUnix);
  if (!Number.isFinite(unixSeconds)) return;

  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return;

  breadcrumbTime.textContent = `${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)} Raffle`;
}

function formatRaffleOverview() {
  const list = document.querySelector(".raffle-overview-list");
  if (!(list instanceof HTMLElement)) return;

  const liveRound = list.querySelector(".raffle-overview-item-live");
  if (liveRound instanceof HTMLElement && list.firstElementChild !== liveRound) {
    list.prepend(liveRound);
  }

  list.querySelectorAll(".raffle-overview-identity").forEach((identity) => {
    if (!(identity instanceof HTMLElement)) return;

    const heading = identity.querySelector("h2");
    const drawingTime = identity.querySelector("time[data-local-time-unix]");
    if (!(heading instanceof HTMLHeadingElement) || !(drawingTime instanceof HTMLTimeElement)) return;

    const unixSeconds = Number(drawingTime.dataset.localTimeUnix);
    if (!Number.isFinite(unixSeconds)) return;

    const date = new Date(unixSeconds * 1000);
    if (Number.isNaN(date.getTime())) return;

    heading.textContent = new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);

    const drawingLine = drawingTime.closest("p");
    if (drawingLine instanceof HTMLParagraphElement) drawingLine.remove();
  });
}

function localDateTimeInputValue(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initializeRaffleEditForm(form) {
  const drawingInput = form.querySelector("[data-raffle-admin-drawing]");
  const drawingUnix = Number(form.dataset.drawingUnix || "0");
  if (!(drawingInput instanceof HTMLInputElement) || !Number.isFinite(drawingUnix) || drawingUnix <= 0) return;
  drawingInput.value = localDateTimeInputValue(drawingUnix);
}

function rafflePromiseText(form) {
  const countInput = form.querySelector("[data-raffle-ticket-count]");
  if (!(countInput instanceof HTMLInputElement)) return "";

  const count = Number(countInput.value);
  if (!Number.isInteger(count) || count <= 0) return "Enter a positive whole number of tickets.";

  try {
    const ticketPrice = BigInt(form.dataset.ticketPrice || "0");
    const promisedGold = ticketPrice * BigInt(count);
    return `${count} ${count === 1 ? "ticket" : "tickets"} · ${promisedGold.toString()} gold promised`;
  } catch {
    return "Unable to calculate the promised deposit.";
  }
}

function refreshRafflePromise(form) {
  const preview = form.querySelector("[data-raffle-promise]");
  if (preview instanceof HTMLElement) preview.textContent = rafflePromiseText(form);
}

async function submitRaffleClaim(form) {
  const status = form.querySelector("[data-raffle-claim-status]");
  const characterSelect = form.querySelector("[data-raffle-character]");
  const countInput = form.querySelector("[data-raffle-ticket-count]");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!(status instanceof HTMLElement)
      || !(characterSelect instanceof HTMLSelectElement)
      || !(countInput instanceof HTMLInputElement)
      || !(submitButton instanceof HTMLButtonElement)) return;

  const cutoffUnix = Number(form.dataset.claimCutoffUnix || "0");
  if (Number.isFinite(cutoffUnix) && cutoffUnix > 0 && Math.floor(Date.now() / 1000) >= cutoffUnix) {
    status.textContent = "Claim submission has closed for this raffle.";
    submitButton.disabled = true;
    return;
  }

  const option = characterSelect.selectedOptions[0];
  const realmId = option?.dataset.realmId;
  const characterId = option?.dataset.characterId;
  const ticketCount = Number(countInput.value);
  const roundId = form.dataset.roundId;

  if (!roundId || !realmId || !characterId || !Number.isInteger(ticketCount) || ticketCount <= 0) {
    status.textContent = "Choose a character and enter a positive whole number of tickets.";
    return;
  }

  submitButton.disabled = true;
  status.textContent = "Submitting claim…";

  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/claims`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        realm_id: realmId,
        character_id: characterId,
        ticket_count: ticketCount,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = result.message || result.error || "Unable to submit raffle claim.";
      return;
    }

    window.location.reload();
  } catch {
    status.textContent = "Unable to submit raffle claim.";
  } finally {
    submitButton.disabled = false;
  }
}

async function cancelRaffleClaim(button) {
  const claimId = button.dataset.cancelRaffleClaim;
  if (!claimId) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Cancelling…";

  try {
    const response = await fetch(`/raffle/claims/${encodeURIComponent(claimId)}/cancel`, {
      method: "POST",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to cancel raffle claim.");
      return;
    }

    window.location.reload();
  } catch {
    window.alert("Unable to cancel raffle claim.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function createRaffleRound(form) {
  const drawingInput = form.querySelector("[data-raffle-admin-drawing]");
  const priceInput = form.querySelector("[data-raffle-admin-price]");
  const winnerInput = form.querySelector("[data-raffle-admin-winner-percentage]");
  const status = form.querySelector("[data-raffle-admin-status]");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!(drawingInput instanceof HTMLInputElement)
      || !(priceInput instanceof HTMLInputElement)
      || !(winnerInput instanceof HTMLInputElement)
      || !(status instanceof HTMLElement)
      || !(submitButton instanceof HTMLButtonElement)) return;

  const drawingMilliseconds = Date.parse(drawingInput.value);
  const ticketPrice = Number(priceInput.value);
  const winnerPercentage = Number(winnerInput.value);

  if (!Number.isFinite(drawingMilliseconds)
      || !Number.isSafeInteger(ticketPrice) || ticketPrice <= 0
      || !Number.isInteger(winnerPercentage) || winnerPercentage < 1 || winnerPercentage > 100) {
    status.textContent = "Enter a drawing time, positive whole-number ticket price, and winner share from 1 to 100.";
    return;
  }

  submitButton.disabled = true;
  status.textContent = "Creating raffle draft…";

  try {
    const response = await fetch("/raffle/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drawing_at_unix: Math.floor(drawingMilliseconds / 1000),
        ticket_price_gold: ticketPrice,
        prize_kind: "gold",
        winner_percentage: winnerPercentage,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = result.message || result.error || "Unable to create raffle draft.";
      return;
    }

    window.location.reload();
  } catch {
    status.textContent = "Unable to create raffle draft.";
  } finally {
    submitButton.disabled = false;
  }
}

async function updateRaffleRoundForm(form) {
  const roundId = form.dataset.roundId;
  const drawingInput = form.querySelector("[data-raffle-admin-drawing]");
  const priceInput = form.querySelector("[data-raffle-admin-price]");
  const winnerInput = form.querySelector("[data-raffle-admin-winner-percentage]");
  const status = form.querySelector("[data-raffle-admin-status]");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!roundId
      || !(drawingInput instanceof HTMLInputElement)
      || !(priceInput instanceof HTMLInputElement)
      || !(winnerInput instanceof HTMLInputElement)
      || !(status instanceof HTMLElement)
      || !(submitButton instanceof HTMLButtonElement)) return;

  const drawingMilliseconds = Date.parse(drawingInput.value);
  const ticketPrice = Number(priceInput.value);
  const winnerPercentage = Number(winnerInput.value);

  if (!Number.isFinite(drawingMilliseconds)
      || !Number.isSafeInteger(ticketPrice) || ticketPrice <= 0
      || !Number.isInteger(winnerPercentage) || winnerPercentage < 1 || winnerPercentage > 100) {
    status.textContent = "Enter a drawing time, positive whole-number ticket price, and winner share from 1 to 100.";
    return;
  }

  submitButton.disabled = true;
  status.textContent = "Saving changes…";

  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drawing_at_unix: Math.floor(drawingMilliseconds / 1000),
        ticket_price_gold: ticketPrice,
        prize_kind: "gold",
        winner_percentage: winnerPercentage,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = result.message || result.error || "Unable to save raffle changes.";
      return;
    }

    window.location.reload();
  } catch {
    status.textContent = "Unable to save raffle changes.";
  } finally {
    submitButton.disabled = false;
  }
}

async function activateRaffleRound(button) {
  const roundId = button.dataset.activateRaffleRound;
  if (!roundId) return;
  if (!window.confirm("Open this raffle? Its terms will be locked and members will be able to participate.")) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Opening raffle…";

  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/live`, {
      method: "POST",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to open raffle.");
      return;
    }

    window.location.assign(`/admin/raffle/${encodeURIComponent(roundId)}`);
  } catch {
    window.alert("Unable to open raffle.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function drawRaffleRound(button) {
  const roundId = button.dataset.drawRaffleRound;
  if (!roundId) return;
  if (!window.confirm("Draw this raffle now? This will permanently conclude the round.")) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Drawing…";

  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/draw`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.message || result.error || "Unable to draw raffle.");
      return;
    }

    window.location.assign(`/admin/raffle/${encodeURIComponent(roundId)}`);
  } catch {
    window.alert("Unable to draw raffle.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function cancelRaffleRound(button) {
  const roundId = button.dataset.cancelRaffleRound;
  if (!roundId) return;
  if (!window.confirm("Cancel this raffle round? The round and its claims will remain in history.")) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Cancelling round…";

  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/cancel`, {
      method: "POST",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to cancel raffle round.");
      return;
    }

    window.location.assign("/admin/raffle");
  } catch {
    window.alert("Unable to cancel raffle round.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function approveRaffleClaim(button) {
  const claimId = button.dataset.approveRaffleClaim;
  if (!claimId) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Approving…";

  try {
    const response = await fetch(`/raffle/claims/${encodeURIComponent(claimId)}/approve`, {
      method: "POST",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to approve raffle claim.");
      return;
    }
    window.location.reload();
  } catch {
    window.alert("Unable to approve raffle claim.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function denyRaffleClaim(button) {
  const claimId = button.dataset.denyRaffleClaim;
  if (!claimId) return;

  const controls = button.closest(".raffle-claim-controls");
  const reasonInput = document.querySelector(`[data-raffle-denial-reason="${CSS.escape(claimId)}"]`);
  if (!(controls instanceof HTMLElement) || !(reasonInput instanceof HTMLInputElement)) return;

  if (!controls.classList.contains("raffle-claim-controls-denying")) {
    controls.classList.add("raffle-claim-controls-denying");
    reasonInput.required = true;
    button.setAttribute("aria-expanded", "true");
    button.textContent = "Confirm denial";
    reasonInput.focus();
    return;
  }

  if (!reasonInput.value.trim()) {
    reasonInput.setCustomValidity("Enter a denial reason before denying this claim.");
    reasonInput.reportValidity();
    reasonInput.focus();
    return;
  }
  reasonInput.setCustomValidity("");

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Denying…";

  try {
    const response = await fetch(`/raffle/claims/${encodeURIComponent(claimId)}/deny`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reasonInput.value.trim() }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to deny raffle claim.");
      return;
    }
    window.location.reload();
  } catch {
    window.alert("Unable to deny raffle claim.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.querySelectorAll("[data-raffle-claim-form]").forEach((form) => {
  if (!(form instanceof HTMLFormElement)) return;
  refreshRafflePromise(form);

  form.addEventListener("input", () => refreshRafflePromise(form));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitRaffleClaim(form);
  });
});

document.querySelectorAll("[data-raffle-admin-create]").forEach((form) => {
  if (!(form instanceof HTMLFormElement)) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void createRaffleRound(form);
  });
});

document.querySelectorAll("[data-raffle-admin-edit]").forEach((form) => {
  if (!(form instanceof HTMLFormElement)) return;
  initializeRaffleEditForm(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void updateRaffleRoundForm(form);
  });
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches("[data-raffle-denial-reason]")) return;
  target.setCustomValidity("");
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const setupToggle = target.closest("[data-toggle-raffle-setup]");
  if (setupToggle instanceof HTMLButtonElement) {
    const setup = document.querySelector("[data-raffle-setup]");
    if (setup instanceof HTMLElement) {
      setup.hidden = !setup.hidden;
      setupToggle.textContent = setup.hidden ? "Start a raffle" : "Hide raffle setup";
      if (!setup.hidden) setup.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  const cancelClaimButton = target.closest("[data-cancel-raffle-claim]");
  if (cancelClaimButton instanceof HTMLButtonElement) {
    void cancelRaffleClaim(cancelClaimButton);
    return;
  }

  const activateButton = target.closest("[data-activate-raffle-round]");
  if (activateButton instanceof HTMLButtonElement) {
    void activateRaffleRound(activateButton);
    return;
  }

  const drawButton = target.closest("[data-draw-raffle-round]");
  if (drawButton instanceof HTMLButtonElement) {
    void drawRaffleRound(drawButton);
    return;
  }

  const cancelRoundButton = target.closest("[data-cancel-raffle-round]");
  if (cancelRoundButton instanceof HTMLButtonElement) {
    void cancelRaffleRound(cancelRoundButton);
    return;
  }

  const approveButton = target.closest("[data-approve-raffle-claim]");
  if (approveButton instanceof HTMLButtonElement) {
    void approveRaffleClaim(approveButton);
    return;
  }

  const denyButton = target.closest("[data-deny-raffle-claim]");
  if (denyButton instanceof HTMLButtonElement) void denyRaffleClaim(denyButton);
});

formatRaffleAdminBreadcrumb();
formatRaffleOverview();
