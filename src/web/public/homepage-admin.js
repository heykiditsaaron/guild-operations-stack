const homepageForm = document.querySelector("[data-homepage-form]");

if (homepageForm) {
  const primitives = homepageForm.querySelector("[data-homepage-primitives]");
  const feedback = homepageForm.querySelector("[data-homepage-feedback]");
  const save = homepageForm.querySelector("[data-homepage-save]");

  function controls() {
    return `<div class="homepage-section-controls"><button type="button" class="button-secondary" data-homepage-move-up aria-label="Move piece up">↑</button><button type="button" class="button-secondary" data-homepage-move-down aria-label="Move piece down">↓</button><button type="button" class="button-secondary" data-homepage-remove>Remove</button></div>`;
  }

  function cardTextField(index, value = "") {
    const label = document.createElement("label");
    label.innerHTML = `<span>Text ${index + 1}</span><textarea rows="3" data-homepage-card-text></textarea>`;
    label.querySelector("textarea").value = value;
    return label;
  }

  function syncCardTexts(card) {
    const layout = card.querySelector("[data-homepage-layout]").value;
    const container = card.querySelector("[data-homepage-card-texts]");
    const desired = layout === "triple" ? 3 : layout === "double" ? 2 : 1;
    while (container.children.length < desired) container.append(cardTextField(container.children.length));
    while (container.children.length > desired) container.lastElementChild.remove();
    [...container.children].forEach((label, index) => {
      label.querySelector("span").textContent = `Text ${index + 1}`;
    });
  }

  function addPrimitive(kind) {
    const article = document.createElement("article");
    article.className = "homepage-section-editor settings-panel";
    article.dataset.homepagePrimitive = "";
    article.dataset.kind = kind;

    if (kind === "card") {
      article.innerHTML = `<div class="homepage-section-editor-heading"><strong>Card</strong>${controls()}</div><div class="homepage-section-fields"><label><span>Columns</span><select data-homepage-layout><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option></select></label><label><span>Title</span><input type="text" data-homepage-heading></label><div class="homepage-card-texts" data-homepage-card-texts></div></div>`;
      article.querySelector("[data-homepage-card-texts]").append(cardTextField(0));
    } else {
      article.innerHTML = `<div class="homepage-section-editor-heading"><strong>Statement</strong>${controls()}</div><div class="homepage-section-fields"><label><span>Kicker <small>optional</small></span><input type="text" data-homepage-kicker></label><label><span>Heading <small>optional</small></span><input type="text" data-homepage-heading></label><label><span>Text</span><textarea rows="3" data-homepage-body></textarea></label></div>`;
    }

    primitives.append(article);
    article.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  homepageForm.querySelector("[data-homepage-add-card]")?.addEventListener("click", () => addPrimitive("card"));
  homepageForm.querySelector("[data-homepage-add-statement]")?.addEventListener("click", () => addPrimitive("statement"));

  primitives.addEventListener("change", (event) => {
    if (event.target.matches("[data-homepage-layout]")) syncCardTexts(event.target.closest("[data-homepage-primitive]"));
  });

  primitives.addEventListener("click", (event) => {
    const primitive = event.target.closest("[data-homepage-primitive]");
    if (!primitive) return;
    if (event.target.closest("[data-homepage-remove]")) primitive.remove();
    if (event.target.closest("[data-homepage-move-up]") && primitive.previousElementSibling) primitives.insertBefore(primitive, primitive.previousElementSibling);
    if (event.target.closest("[data-homepage-move-down]") && primitive.nextElementSibling) primitives.insertBefore(primitive.nextElementSibling, primitive);
  });

  homepageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.textContent = "Saving…";
    save.disabled = true;

    const payload = {
      lede: homepageForm.querySelector("[data-homepage-lede]").value,
      supportingText: homepageForm.querySelector("[data-homepage-supporting-text]").value,
      primitives: [...primitives.querySelectorAll("[data-homepage-primitive]")].map((primitive) => {
        if (primitive.dataset.kind === "card") {
          return {
            kind: "card",
            layout: primitive.querySelector("[data-homepage-layout]").value,
            heading: primitive.querySelector("[data-homepage-heading]").value,
            texts: [...primitive.querySelectorAll("[data-homepage-card-text]")].map((field) => field.value),
          };
        }
        return {
          kind: "statement",
          kicker: primitive.querySelector("[data-homepage-kicker]").value,
          heading: primitive.querySelector("[data-homepage-heading]").value,
          body: primitive.querySelector("[data-homepage-body]").value,
        };
      }),
    };

    try {
      const response = await fetch("/admin/homepage", {
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
