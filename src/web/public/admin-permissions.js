for (const input of document.querySelectorAll("[data-rank-capability]")) {
  input.addEventListener("change", async () => {
    const status = input.closest("label")?.querySelector("[data-capability-status]");
    const rankIndex = Number(input.dataset.rankIndex);
    const previous = input.dataset.permittedRanks.split(",").filter(Boolean).map(Number);
    const next = input.checked ? [...new Set([...previous, rankIndex])].sort((a, b) => a - b) : previous.filter((rank) => rank !== rankIndex);
    const peers = [...document.querySelectorAll("[data-rank-capability]")].filter((peer) => peer.dataset.rankCapability === input.dataset.rankCapability);
    for (const peer of peers) peer.disabled = true;
    if (status) status.textContent = "Saving…";
    try {
      const response = await fetch(`/admin/permissions/${encodeURIComponent(input.dataset.rankCapability)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permittedRanks: next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Permission could not be saved");
      for (const peer of peers) peer.dataset.permittedRanks = body.permittedRanks.join(",");
      if (status) status.textContent = "Saved.";
    } catch (error) {
      input.checked = !input.checked;
      if (status) status.textContent = error instanceof Error ? error.message : "Save failed.";
    } finally {
      for (const peer of peers) peer.disabled = Number(peer.dataset.rankIndex) === 0;
    }
  });
}

for (const form of document.querySelectorAll("[data-rank-name-form]")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.querySelector('input[name="displayName"]');
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector("[data-rank-name-status]");
    if (!input) return;
    button.disabled = true;
    if (status) status.textContent = "Saving…";
    try {
      const response = await fetch(`/admin/ranks/${encodeURIComponent(form.dataset.rankIndex)}/display-name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: input.value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Rank name could not be saved");
      const workspace = form.closest("[data-rank-workspace]");
      const heading = workspace?.querySelector("h2");
      if (heading) heading.textContent = body.rank.displayName;
      const link = document.querySelector(`a[href="#rank-${form.dataset.rankIndex}"]`);
      if (link) link.firstChild.textContent = body.rank.displayName + " ";
      if (status) status.textContent = "Saved.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Save failed.";
    } finally {
      button.disabled = false;
    }
  });
}
