const rankSelectors = [...document.querySelectorAll("[data-rank-select]")];
const rankWorkspaces = [...document.querySelectorAll("[data-rank-workspace]")];
function selectRank(rankIndex) {
  for (const button of rankSelectors) {
    const selected = button.dataset.rankSelect === String(rankIndex);
    button.setAttribute("aria-pressed", String(selected));
  }
  for (const workspace of rankWorkspaces) workspace.hidden = workspace.id !== `rank-${rankIndex}`;
}
for (const button of rankSelectors) button.addEventListener("click", () => selectRank(button.dataset.rankSelect));
if (rankSelectors.length) {
  const requestedRank = location.hash.match(/^#rank-(\d+)$/)?.[1];
  selectRank(rankSelectors.some((button) => button.dataset.rankSelect === requestedRank) ? requestedRank : rankSelectors[0].dataset.rankSelect);
}

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
      const heading = workspace?.querySelector("[data-rank-heading]");
      if (heading) heading.textContent = body.rank.displayName;
      const label = document.querySelector(`[data-rank-select="${form.dataset.rankIndex}"] [data-rank-label]`);
      if (label) label.textContent = body.rank.displayName;
      if (status) status.textContent = "Saved.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Save failed.";
    } finally {
      button.disabled = false;
    }
  });
}

// Move existing Discord role selectors into the corresponding rank workspaces.
// All selectors still submit together through the existing batch configuration endpoint.
const discordRoleFields = document.querySelector("[data-discord-role-fields]");
if (discordRoleFields) {
  let moved = 0;
  for (const field of [...discordRoleFields.querySelectorAll("[data-discord-rank-field]")]) {
    const slot = document.querySelector('[data-discord-role-slot="' + field.dataset.discordRankField + '"]');
    if (!slot) continue;
    slot.append(field);
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "button-secondary";
    save.setAttribute("form", "discord-role-mappings-form");
    save.textContent = "Save role mapping";
    slot.append(save);
    moved++;
  }
  if (moved && !discordRoleFields.children.length) {
    const globalSave = document.querySelector("[data-discord-role-global-save]");
    if (globalSave) globalSave.hidden = true;
  }
  const section = discordRoleFields.closest(".admin-section");
  if (section && moved && !discordRoleFields.children.length) section.classList.add("discord-role-mappings-relocated");
}
