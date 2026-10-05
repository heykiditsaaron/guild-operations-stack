const homepageForm = document.querySelector("[data-homepage-form]");

if (homepageForm) {
  const sections = homepageForm.querySelector("[data-homepage-sections]");
  const feedback = homepageForm.querySelector("[data-homepage-feedback]");
  const save = homepageForm.querySelector("[data-homepage-save]");

  function cardEditor() {
    const wrapper = document.createElement("div");
    wrapper.className = "homepage-card-editor";
    wrapper.dataset.homepageCard = "";
    wrapper.innerHTML = `<label><span>Card title</span><input type="text" data-homepage-card-title></label><label><span>Card text</span><textarea rows="3" data-homepage-card-body></textarea></label>`;
    return wrapper;
  }

  function sectionControls() {
    return `<div class="homepage-section-controls"><button type="button" class="button-secondary" data-homepage-move-up aria-label="Move section up">↑</button><button type="button" class="button-secondary" data-homepage-move-down aria-label="Move section down">↓</button><button type="button" class="button-secondary" data-homepage-remove>Remove</button></div>`;
  }

  function commonFields() {
    return `<label><span>Kicker <small>optional</small></span><input type="text" data-homepage-kicker></label><label><span>Heading <small>optional</small></span><input type="text" data-homepage-heading></label>`;
  }

  function addSection(kind) {
    const article = document.createElement("article");
    article.className = "homepage-section-editor settings-panel";
    article.dataset.homepageSection = "";
    article.dataset.kind = kind;
    if (kind === "statement") {
      article.innerHTML = `<div class="homepage-section-editor-heading"><strong>Statement</strong>${sectionControls()}</div><div class="homepage-section-fields">${commonFields()}<label><span>Text</span><textarea rows="3" data-homepage-body></textarea></label></div>`;
    } else {
      article.innerHTML = `<div class="homepage-section-editor-heading"><strong>Card group</strong>${sectionControls()}</div><div class="homepage-section-fields">${commonFields()}<label><span>Introduction <small>optional</small></span><textarea rows="3" data-homepage-body></textarea></label><label><span>Cards</span><select data-homepage-layout><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option></select></label><div class="homepage-card-editors" data-homepage-cards></div></div>`;
      article.querySelector("[data-homepage-cards]").append(cardEditor());
    }
    sections.append(article);
    article.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function syncCards(section) {
    const layout = section.querySelector("[data-homepage-layout]");
    const cards = section.querySelector("[data-homepage-cards]");
    if (!layout || !cards) return;
    const desired = layout.value === "triple" ? 3 : layout.value === "double" ? 2 : 1;
    while (cards.children.length < desired) cards.append(cardEditor());
    while (cards.children.length > desired) cards.lastElementChild.remove();
  }

  homepageForm.querySelector("[data-homepage-add-cards]")?.addEventListener("click", () => addSection("cards"));
  homepageForm.querySelector("[data-homepage-add-statement]")?.addEventListener("click", () => addSection("statement"));

  sections.addEventListener("change", (event) => {
    if (event.target.matches("[data-homepage-layout]")) syncCards(event.target.closest("[data-homepage-section]"));
  });

  sections.addEventListener("click", (event) => {
    const section = event.target.closest("[data-homepage-section]");
    if (!section) return;
    if (event.target.closest("[data-homepage-remove]")) section.remove();
    if (event.target.closest("[data-homepage-move-up]") && section.previousElementSibling) sections.insertBefore(section, section.previousElementSibling);
    if (event.target.closest("[data-homepage-move-down]") && section.nextElementSibling) sections.insertBefore(section.nextElementSibling, section);
  });

  homepageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.textContent = "Saving…";
    save.disabled = true;

    const payload = {
      lede: homepageForm.querySelector("[data-homepage-lede]").value,
      supportingText: homepageForm.querySelector("[data-homepage-supporting-text]").value,
      sections: [...sections.querySelectorAll("[data-homepage-section]")].map((section) => {
        const common = {
          kind: section.dataset.kind,
          kicker: section.querySelector("[data-homepage-kicker]").value,
          heading: section.querySelector("[data-homepage-heading]").value,
          body: section.querySelector("[data-homepage-body]").value,
        };
        if (section.dataset.kind === "statement") return common;
        return {
          ...common,
          layout: section.querySelector("[data-homepage-layout]").value,
          cards: [...section.querySelectorAll("[data-homepage-card]")].map((card) => ({
            title: card.querySelector("[data-homepage-card-title]").value,
            body: card.querySelector("[data-homepage-card-body]").value,
          })),
        };
      }),
    };

    try {
      const response = await fetch("/admin/general/homepage", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Homepage could not be saved");
      feedback.textContent = "Homepage saved.";
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : "Homepage could not be saved.";
    } finally {
      save.disabled = false;
    }
  });
}
