function raffleCountdownText(secondsRemaining) {
  const total = Math.max(0, Math.floor(secondsRemaining));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days > 0 ? `${days}d ${clock}` : clock;
}

function closeHomeRafflePromotion(element) {
  const promotion = element.closest("[data-home-raffle-promo]");
  if (!(promotion instanceof HTMLAnchorElement)) return;

  promotion.href = "/events/raffle";
  const label = promotion.querySelector("[data-home-raffle-cta-label]");
  if (label instanceof HTMLElement) label.textContent = "Entries closed · View raffle";
}

function refreshRaffleCountdown(element) {
  const cutoffUnix = Number(element.dataset.raffleCutoffUnix || "0");
  if (!Number.isFinite(cutoffUnix) || cutoffUnix <= 0) return false;

  const secondsRemaining = cutoffUnix - Date.now() / 1000;
  const block = element.closest("[data-raffle-countdown-block]");
  const caption = block?.querySelector("[data-raffle-countdown-caption]");
  const entryAction = document.querySelector("[data-raffle-entry-action]");

  if (secondsRemaining <= 0) {
    element.textContent = "Entries closed";
    if (block instanceof HTMLElement) block.dataset.raffleClosed = "true";
    if (caption instanceof HTMLElement) caption.textContent = "Awaiting the officer-run drawing";
    if (entryAction instanceof HTMLElement) entryAction.hidden = true;
    closeHomeRafflePromotion(element);
    return true;
  }

  element.textContent = raffleCountdownText(secondsRemaining);
  return false;
}

const raffleCountdowns = Array.from(document.querySelectorAll("[data-raffle-cutoff-unix]"));

if (raffleCountdowns.length > 0) {
  const refresh = () => {
    let allClosed = true;
    for (const element of raffleCountdowns) {
      if (!(element instanceof HTMLElement)) continue;
      allClosed = refreshRaffleCountdown(element) && allClosed;
    }
    return allClosed;
  };

  const allClosed = refresh();
  if (!allClosed) {
    const interval = window.setInterval(() => {
      if (refresh()) window.clearInterval(interval);
    }, 1000);
  }
}
