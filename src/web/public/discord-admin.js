document.querySelector("[data-copy-discord-callback]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const value = button.parentElement?.querySelector("code")?.textContent;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Select and copy the URL";
  }
});
