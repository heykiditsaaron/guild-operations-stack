document.documentElement.dataset.webRenderer = "ready";

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const logout = target.closest("[data-logout]");
  if (!logout) return;

  void fetch("/auth/logout", { method: "POST" }).then((response) => {
    if (response.ok) window.location.assign("/");
  });
});

document.addEventListener("toggle", (event) => {
  const opened = event.target;
  if (!(opened instanceof HTMLDetailsElement) || !opened.open) return;

  document.querySelectorAll("details.menu-surface[open]").forEach((details) => {
    if (details !== opened) details.removeAttribute("open");
  });
}, true);
