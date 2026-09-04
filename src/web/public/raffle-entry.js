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

function showRaffleClaimSuccess(form) {
  const success = document.createElement("div");
  success.className = "raffle-entry-success";
  success.setAttribute("role", "status");

  const title = document.createElement("strong");
  title.textContent = "Claim entered";

  const copy = document.createElement("p");
  copy.textContent = "Your claim has been recorded and is awaiting attendant review.";

  const link = document.createElement("a");
  link.className = "raffle-action raffle-action-secondary";
  link.href = "/events/raffle/claims";
  link.textContent = "View your claims";

  success.append(title, copy, link);
  form.replaceWith(success);
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

    showRaffleClaimSuccess(form);
  } catch {
    status.textContent = "Unable to submit raffle claim.";
  } finally {
    submitButton.disabled = false;
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
