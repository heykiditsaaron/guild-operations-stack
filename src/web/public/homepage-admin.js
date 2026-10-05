const homepageForm = document.querySelector("[data-homepage-form]");

if (homepageForm) {
  const primitives = homepageForm.querySelector("[data-homepage-primitives]");
  const feedback = homepageForm.querySelector("[data-homepage-feedback]");
  const save = homepageForm.querySelector("[data-homepage-save]");

  function controls() {
    return `<div class="homepage-section-controls"><button type="button" class="button-secondary" data-homepage-move-up aria-label="Move piece up">↑</button><button type="button" class="button-secondary" data-homepage-move-down aria-label="Move piece down">↓</button><button type="button" class="button-secondary" data-homepage-remove>Remove</button></div>`;
  }

  function cardTextField(index, value = "") {
    const row = document.createElement("div");
    row.className = "homepage-card-text";
    row.innerHTML = `<label><span>Text ${index + 1}</span><textarea rows="3" data-homepage-card-text></textarea></label>${index === 0 ? "" : '<button type="button" class="homepage-card-text-remove" data-homepage-remove-text aria-label="Remove this text">×</button>'}`;
    row.querySelector("textarea").value = value;
    return row;
  }

  function renumberCardTexts(card) {
    [...card.querySelectorAll(".homepage-card-text")].forEach((row, index) => {
      row.querySelector("span").textContent = `Text ${index + 1}`;
      const remove = row.querySelector("[data-homepage-remove-text]");
      if (index === 0 && remove) remove.remove();
      if (index > 0 && !remove) {
        row.insertAdjacentHTML("beforeend", '<button type="button" class="homepage-card-text-remove" data-homepage-remove-text aria-label="Remove this text">×</button>');
      }
    });
  }

  function addPrimitive(kind) {
    const article = document.createElement("article");
    article.className = "homepage-section-editor settings-panel";
    article.dataset.homepagePrimitive = "";
    article.dataset.kind = kind;

    if (kind === "card") {
      article.innerHTML = `<div class="homepage-section-editor-heading"><strong>Card</strong>${controls()}</div><div class="homepage-section-fields"><label><span>Title</span><input type="text" data-homepage-heading></label><div class="homepage-card-texts" data-homepage-card-texts></div><div><button type="button" class="button-secondary homepage-add-text" data-homepage-add-text>+ Add text</button></div></div>`;
      article.querySelector("[data-homepage-card-texts]").append(cardTextField(0));
    } else {
      article.innerHTML = `<div class="homepage-section-editor-heading"><strong>Statement</strong>${controls()}</div><div class="homepage-section-fields"><label><span>Kicker <small>optional</small></span><input type="text" data-homepage-kicker></label><label><span>Heading <small>optional</small></span><input type="text" data-homepage-heading></label><label><span>Text</span><textarea rows="3" data-homepage-body></textarea></label></div>`;
    }

    primitives.append(article);
    article.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  homepageForm.querySelector("[data-homepage-add-card]")?.addEventListener("click", () => addPrimitive("card"));
  homepageForm.querySelector("[data-homepage-add-statement]")?.addEventListener("click", () => addPrimitive("statement"));

  primitives.addEventListener("click", (event) => {
    const primitive = event.target.closest("[data-homepage-primitive]");
    if (!primitive) return;
    if (event.target.closest("[data-homepage-add-text]")) {
      const container = primitive.querySelector("[data-homepage-card-texts]");
      container.append(cardTextField(container.children.length));
      return;
    }
    if (event.target.closest("[data-homepage-remove-text]")) {
      event.target.closest(".homepage-card-text").remove();
      renumberCardTexts(primitive);
      return;
    }
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
