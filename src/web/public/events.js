(() => {
  const root = document.querySelector(".events-calendar-widget");
  if (!root) return;

  const source = root.querySelector(".events-calendar-source");
  const sourceOccurrences = source
    ? Array.from(source.querySelectorAll("[data-calendar-occurrence]"))
    : [];
  const viewButtons = Array.from(root.querySelectorAll("[data-calendar-view]"));
  const panels = Array.from(root.querySelectorAll("[data-calendar-panel]"));
  let activeView = root.dataset.calendarInitialView || "agenda";
  let weekOffset = 0;
  let monthOffset = 0;

  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const addDays = (value, days) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const occurrenceDate = (node) => new Date(Number(node.dataset.startUnix) * 1000);
  const occurrencesForDay = (day) =>
    sourceOccurrences.filter((node) => sameDay(occurrenceDate(node), day));
  const cloneOccurrence = (node) => {
    const clone = node.cloneNode(true);
    clone.classList.add("events-calendar-card");
    return clone;
  };
  const emptyDay = () => {
    const empty = document.createElement("p");
    empty.className = "events-day-empty";
    empty.textContent = "Nothing scheduled";
    return empty;
  };

  function renderWeek() {
    const panel = root.querySelector('[data-calendar-panel="week"]');
    const target = panel?.querySelector("[data-calendar-week]");
    const label = panel?.querySelector("[data-calendar-period-label]");
    if (!target || !label) return;

    const first = addDays(startOfDay(new Date()), weekOffset * 7);
    const last = addDays(first, 6);
    label.textContent = first.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " – " + last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    target.replaceChildren();

    for (let offset = 0; offset < 7; offset += 1) {
      const day = addDays(first, offset);
      const section = document.createElement("section");
      section.className = "events-week-day";
      if (sameDay(day, new Date())) section.classList.add("is-today");

      const heading = document.createElement("h3");
      heading.className = "events-day-heading";
      heading.innerHTML = `<span>${day.toLocaleDateString(undefined, { weekday: "short" })}</span><strong>${day.getDate()}</strong>`;
      section.append(heading);

      const occurrences = occurrencesForDay(day);
      if (!occurrences.length) section.append(emptyDay());
      occurrences.forEach((node) => section.append(cloneOccurrence(node)));
      target.append(section);
    }
  }

  function renderMonth() {
    const panel = root.querySelector('[data-calendar-panel="month"]');
    const target = panel?.querySelector("[data-calendar-month]");
    const label = panel?.querySelector("[data-calendar-period-label]");
    if (!target || !label) return;

    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    label.textContent = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    target.replaceChildren();

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    weekdayLabels.forEach((name) => {
      const heading = document.createElement("div");
      heading.className = "events-month-weekday";
      heading.textContent = name;
      target.append(heading);
    });

    const firstCell = new Date(month);
    firstCell.setDate(1 - month.getDay());
    for (let offset = 0; offset < 42; offset += 1) {
      const day = addDays(firstCell, offset);
      const cell = document.createElement("section");
      cell.className = "events-month-day";
      if (day.getMonth() !== month.getMonth()) cell.classList.add("is-outside-month");
      if (sameDay(day, now)) cell.classList.add("is-today");

      const heading = document.createElement("h3");
      heading.className = "events-month-date";
      heading.textContent = String(day.getDate());
      cell.append(heading);

      occurrencesForDay(day).forEach((node) => cell.append(cloneOccurrence(node)));
      target.append(cell);
    }
  }

  function setView(view, persist = false) {
    activeView = view;
    viewButtons.forEach((button) => {
      const selected = button.dataset.calendarView === view;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.calendarPanel !== view;
    });
    if (view === "week") renderWeek();
    if (view === "month") renderMonth();
    if (persist) {
      fetch("/events/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ view }),
      }).catch(() => {});
    }
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.calendarView || "agenda", true));
  });

  setView(activeView);

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-shift]");
    if (!button) return;
    const shift = Number(button.dataset.calendarShift);
    if (activeView === "week") {
      weekOffset += shift;
      renderWeek();
    } else if (activeView === "month") {
      monthOffset += shift;
      renderMonth();
    }
  });
})();