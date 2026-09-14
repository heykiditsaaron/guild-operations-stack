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

  list.querySelectorAll(".raffle-overview-identity").forEach((identity) => {
    if (!(identity instanceof HTMLElement)) return;

    const heading = identity.querySelector("h2");
    if (!(heading instanceof HTMLHeadingElement)) return;

    const headingTime = heading.querySelector("time[data-local-time-unix]");
    if (!(headingTime instanceof HTMLTimeElement)) return;

    const unixSeconds = Number(headingTime.dataset.localTimeUnix);
    if (!Number.isFinite(unixSeconds)) return;

    const date = new Date(unixSeconds * 1000);
    if (Number.isNaN(date.getTime())) return;

    heading.textContent = new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  });
}

function localDateTimeInputValue(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function syncRafflePrizeFields(form) {
  const kindSelect = form.querySelector("[data-raffle-admin-prize-kind]");
  const goldField = form.querySelector("[data-raffle-prize-gold]");
  const descriptionField = form.querySelector("[data-raffle-prize-description]");
  const winnerInput = form.querySelector("[data-raffle-admin-winner-percentage]");
  const descriptionInput = form.querySelector("[data-raffle-admin-prize-description]");
  if (!(kindSelect instanceof HTMLSelectElement)
      || !(goldField instanceof HTMLElement)
      || !(descriptionField instanceof HTMLElement)
      || !(winnerInput instanceof HTMLInputElement)
      || !(descriptionInput instanceof HTMLInputElement)) return;

  const gold = kindSelect.value === "gold";
  const goldLabel = goldField.querySelector("span");
  if (goldLabel instanceof HTMLElement) goldLabel.textContent = "Prize — Percentage of pot";
  goldField.hidden = !gold;
  descriptionField.hidden = gold;
  goldField.style.display = gold ? "" : "none";
  descriptionField.style.display = gold ? "none" : "";
  winnerInput.required = gold;
  winnerInput.disabled = !gold;
  descriptionInput.required = !gold;
  descriptionInput.disabled = gold;
}

function initializeRaffleEditForm(form) {
  const drawingInput = form.querySelector("[data-raffle-admin-drawing]");
  const drawingUnix = Number(form.dataset.drawingUnix || "0");
  if (drawingInput instanceof HTMLInputElement && Number.isFinite(drawingUnix) && drawingUnix > 0) {
    drawingInput.value = localDateTimeInputValue(drawingUnix);
  }
  syncRafflePrizeFields(form);
}

function rafflePromiseText(form) {
  const countInput = form.querySelector("[data-raffle-entry-count]");
  if (!(countInput instanceof HTMLInputElement)) return "";

  const count = Number(countInput.value);
  if (!Number.isInteger(count) || count <= 0) return "Enter a positive whole number of entries.";

  try {
    const entryPrice = BigInt(form.dataset.entryPrice || "0");
    const promisedGold = entryPrice * BigInt(count);
    return `${count} ${count === 1 ? "entry" : "entries"} · ${promisedGold.toString()} gold promised`;
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
  const countInput = form.querySelector("[data-raffle-entry-count]");
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
  const entryCount = Number(countInput.value);
  const roundId = form.dataset.roundId;

  if (!roundId || !realmId || !characterId || !Number.isInteger(entryCount) || entryCount <= 0) {
    status.textContent = "Choose a character and enter a positive whole number of entries.";
    return;
  }

  submitButton.disabled = true;
  status.textContent = "Submitting claim…";

  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/claims`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realm_id: realmId, character_id: characterId, entry_count: entryCount }),
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
    const response = await fetch(`/raffle/claims/${encodeURIComponent(claimId)}/cancel`, { method: "POST" });
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

function raffleAdminTerms(form, status) {
  const titleInput = form.querySelector("[data-raffle-admin-title]");
  const drawingInput = form.querySelector("[data-raffle-admin-drawing]");
  const priceInput = form.querySelector("[data-raffle-admin-price]");
  const kindSelect = form.querySelector("[data-raffle-admin-prize-kind]");
  const winnerInput = form.querySelector("[data-raffle-admin-winner-percentage]");
  const descriptionInput = form.querySelector("[data-raffle-admin-prize-description]");

  if (!(titleInput instanceof HTMLInputElement)
      || !(drawingInput instanceof HTMLInputElement)
      || !(priceInput instanceof HTMLInputElement)
      || !(kindSelect instanceof HTMLSelectElement)
      || !(winnerInput instanceof HTMLInputElement)
      || !(descriptionInput instanceof HTMLInputElement)) return null;

  const roundTitle = titleInput.value.trim();
  const drawingMilliseconds = Date.parse(drawingInput.value);
  const entryPrice = Number(priceInput.value);
  const prizeKind = kindSelect.value;

  if (!Number.isFinite(drawingMilliseconds) || !Number.isSafeInteger(entryPrice) || entryPrice <= 0) {
    status.textContent = "Enter a drawing time and a positive whole-number entry price.";
    return null;
  }
  if (prizeKind !== "gold" && prizeKind !== "item" && prizeKind !== "other") {
    status.textContent = "Choose a valid prize type.";
    return null;
  }

  if (prizeKind === "gold") {
    const winnerPercentage = Number(winnerInput.value);
    if (!Number.isInteger(winnerPercentage) || winnerPercentage < 1 || winnerPercentage > 100) {
      status.textContent = "Gold prize percentage must be a whole number from 1 to 100.";
      return null;
    }
    return {
      round_title: roundTitle || null,
      drawing_at_unix: Math.floor(drawingMilliseconds / 1000),
      entry_price_gold: entryPrice,
      prize_kind: prizeKind,
      winner_percentage: winnerPercentage,
      prize_description: null,
    };
  }

  const prizeDescription = descriptionInput.value.trim();
  if (!prizeDescription) {
    status.textContent = "Describe the prize.";
    return null;
  }
  return {
    round_title: roundTitle || null,
    drawing_at_unix: Math.floor(drawingMilliseconds / 1000),
    entry_price_gold: entryPrice,
    prize_kind: prizeKind,
    winner_percentage: null,
    prize_description: prizeDescription,
  };
}

async function createRaffleRound(form) {
  const status = form.querySelector("[data-raffle-admin-status]");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!(status instanceof HTMLElement) || !(submitButton instanceof HTMLButtonElement)) return;
  const terms = raffleAdminTerms(form, status);
  if (!terms) return;
  submitButton.disabled = true;
  status.textContent = "Creating raffle…";
  try {
    const response = await fetch("/raffle/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(terms),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = result.message || result.error || "Unable to create raffle.";
      return;
    }
    window.location.reload();
  } catch {
    status.textContent = "Unable to create raffle.";
  } finally {
    submitButton.disabled = false;
  }
}

async function updateRaffleRoundForm(form) {
  const roundId = form.dataset.roundId;
  const status = form.querySelector("[data-raffle-admin-status]");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!roundId || !(status instanceof HTMLElement) || !(submitButton instanceof HTMLButtonElement)) return;
  const terms = raffleAdminTerms(form, status);
  if (!terms) return;
  submitButton.disabled = true;
  status.textContent = "Saving changes…";
  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(terms),
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
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/live`, { method: "POST" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to open raffle.");
      return;
    }
    window.location.assign("/events/raffle/manage");
  } catch {
    window.alert("Unable to open raffle.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function raffleResultPrize(round) {
  if (round.prizeKind === "gold" && Number.isInteger(round.winnerPercentage) && Number.isInteger(round.totalEntries)) {
    try {
      const pot = BigInt(round.entryPriceGold) * BigInt(round.totalEntries);
      return `${((pot * BigInt(round.winnerPercentage)) / 100n).toLocaleString("en-US")} gold`;
    } catch {
      return `${round.winnerPercentage}% of the pot`;
    }
  }
  return round.prizeDescription || round.prizeKind || "Prize recorded";
}

async function winningRaffleClaim(roundId, winningClaimId) {
  if (!winningClaimId) return null;
  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/claims`);
    if (!response.ok) return null;
    const result = await response.json().catch(() => ({}));
    return Array.isArray(result.claims)
      ? result.claims.find((claim) => claim.claimId === winningClaimId) || null
      : null;
  } catch {
    return null;
  }
}

function showRaffleDrawResult(round, winnerClaim) {
  const main = document.querySelector(".app-main");
  if (!(main instanceof HTMLElement)) {
    window.location.assign("/events/raffle/manage");
    return;
  }

  const pageTitle = document.querySelector("#page-title");
  if (pageTitle instanceof HTMLElement) pageTitle.textContent = "Raffle result";

  if (round.conclusion === "no_participation") {
    main.innerHTML = `<section class="raffle-admin-message" aria-labelledby="raffle-result-heading">
      <div class="raffle-status-banner raffle-status-banner-upcoming"><span>Raffle concluded</span></div>
      <h2 id="raffle-result-heading">No participation</h2>
      <p class="raffle-section-note">The draw completed with no approved entry population, so no winner was selected.</p>
      <div class="raffle-management-controls">
        <a class="raffle-action raffle-action-primary" href="/events/raffle/manage">Return to raffle operations</a>
        <a class="raffle-action raffle-action-secondary" href="/events/raffle/history">View raffle history ↗</a>
      </div>
    </section>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const winnerName = winnerClaim?.characterName || "Winning claim selected";
  const totalEntries = Number.isInteger(round.totalEntries) ? round.totalEntries.toLocaleString("en-US") : "Recorded";
  const prize = raffleResultPrize(round);
  main.innerHTML = `<section class="raffle-admin-message" aria-labelledby="raffle-result-heading">
    <div class="raffle-status-banner raffle-status-banner-live"><span>Raffle drawn</span></div>
    <h2 id="raffle-result-heading">Winner: ${winnerName}</h2>
    <dl class="raffle-facts">
      <dt>Final entries</dt><dd>${totalEntries}</dd>
      <dt>Prize</dt><dd>${prize}</dd>
    </dl>
    <div class="raffle-management-controls">
      <a class="raffle-action raffle-action-primary" href="/events/raffle/manage">Return to raffle operations</a>
      <a class="raffle-action raffle-action-secondary" href="/events/raffle/history">View raffle history ↗</a>
    </div>
  </section>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function drawRaffleRound(button) {
  const roundId = button.dataset.drawRaffleRound;
  if (!roundId) return;
  if (!window.confirm("Draw this raffle now? This will permanently conclude the round.")) return;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Drawing…";
  try {
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/draw`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.message || result.error || "Unable to draw raffle.");
      return;
    }
    const winnerClaim = result.conclusion === "drawn"
      ? await winningRaffleClaim(roundId, result.winningClaimId)
      : null;
    showRaffleDrawResult(result, winnerClaim);
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
    const response = await fetch(`/raffle/rounds/${encodeURIComponent(roundId)}/cancel`, { method: "POST" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.message || result.error || "Unable to cancel raffle round.");
      return;
    }
    window.location.assign("/events/raffle/manage");
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
    const response = await fetch(`/raffle/claims/${encodeURIComponent(claimId)}/approve`, { method: "POST" });
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
  syncRafflePrizeFields(form);
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

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.matches("[data-raffle-admin-prize-kind]")) return;
  const form = target.closest("form");
  if (form instanceof HTMLFormElement) syncRafflePrizeFields(form);
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
      setupToggle.textContent = setup.hidden ? "Start new raffle" : "Hide raffle setup";
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