document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;

  document.querySelectorAll("details.menu-surface[open]").forEach((details) => {
    if (!details.contains(target)) details.removeAttribute("open");
  });
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches("[data-administration-navigation]")) return;

  const destination = target.value;
  if (!destination) return;
  window.location.assign(destination);
});
