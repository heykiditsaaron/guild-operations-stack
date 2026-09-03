document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;

  document.querySelectorAll("details.menu-surface[open]").forEach((details) => {
    if (!details.contains(target)) details.removeAttribute("open");
  });
});
