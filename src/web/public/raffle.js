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

document.querySelectorAll("[data-raffle-claim-form]").forEach((form) => {
  if (!(form instanceof HTMLFormElement)) return;
  refreshRafflePromise(form);

  form.addEventListener("input", () => refreshRafflePromise(form));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitRaffleClaim(form);
  });
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const cancelButton = target.closest("[data-cancel-raffle-claim]");
  if (cancelButton instanceof HTMLButtonElement) void cancelRaffleClaim(cancelButton);
});
