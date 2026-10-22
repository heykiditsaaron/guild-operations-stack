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

const emojiForm = document.querySelector("[data-emoji-setup]");
emojiForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = emojiForm.querySelector("[data-emoji-submit]");
  const results = emojiForm.querySelector("[data-emoji-results]");
  const status = emojiForm.querySelector("[data-emoji-status]");
  const progress = emojiForm.querySelector("[data-emoji-progress]");
  const counts = emojiForm.querySelector("[data-emoji-counts]");
  const failures = emojiForm.querySelector("[data-emoji-failures]");
  button.disabled = true;
  button.textContent = "Setting up icons…";
  results.hidden = false;
  status.textContent = "Connecting to Discord…";
  progress.removeAttribute("value");
  counts.textContent = "";
  failures.replaceChildren();
  let completed = false;
  const handle = (event) => {
    if (event.type === "start") status.textContent = event.message;
    if (event.type === "progress") {
      progress.max = event.total;
      progress.value = event.processed;
      status.textContent = event.phase === "uploading" ? "Uploading " + event.name + "…" : "Processed " + event.name;
      counts.textContent = event.processed + " of " + event.total + " processed · " + event.created + " created · " + event.reused + " reused · " + event.failed + " failed";
      if (event.phase === "failed") {
        const item = document.createElement("li");
        item.textContent = event.name + ": " + event.reason;
        failures.append(item);
      }
    }
    if (event.type === "complete") {
      completed = true;
      if (event.status === "success") {
        status.textContent = "All Discord icons are ready.";
        button.textContent = "Run setup again";
      } else if (event.status === "partial") {
        status.textContent = event.failed + " icons could not be set up. The others are ready. Retry to provision only missing icons.";
        button.textContent = "Retry missing icons";
      } else {
        status.textContent = event.message || "Setup failed. Retry to continue.";
        button.textContent = "Retry setup";
      }
    }
  };
  try {
    const response = await fetch(emojiForm.action, { method: "POST", credentials: "same-origin" });
    if (!response.ok || !response.body) {
      status.textContent = response.status === 409 ? "Another setup is already running. Try again after it finishes." : "Unable to start setup. Please retry.";
      button.textContent = "Retry setup";
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) if (line.trim()) handle(JSON.parse(line));
      if (done) break;
    }
    if (pending.trim()) handle(JSON.parse(pending));
    if (!completed) {
      status.textContent = "Connection ended before setup finished. Retry to check missing icons.";
      button.textContent = "Retry setup";
    }
  } catch {
    status.textContent = "Connection interrupted. Some icons may be ready; retry to check what remains.";
    button.textContent = "Retry setup";
  } finally {
    button.disabled = false;
  }
});
