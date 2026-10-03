for (const button of document.querySelectorAll("[data-raid-revoke-signup]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("click", async () => {
    const signupRowId = button.dataset.raidRevokeSignup;
    if (!signupRowId) return;
    button.disabled = true;
    button.textContent = "Withdrawing…";
    try {
      const response = await fetch(`${raidMutationBase()}/signup/${encodeURIComponent(signupRowId)}/withdraw`, { method: "POST" });
      const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Raid signup could not be withdrawn");
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Withdraw";
      window.alert(error instanceof Error ? error.message : "Raid signup could not be withdrawn.");
    }
  });
}
