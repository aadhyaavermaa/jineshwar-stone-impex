// The application is mandatory when selected. Colour and finish rank eligible rows.
// Budget, wear and maintenance generate questions because the catalogue has no verified
// prices, lab ratings or sealing schedules to score.
(() => {
  const form = document.getElementById("stone-quiz");
  const loading = document.getElementById("quiz-loading");
  const results = document.getElementById("quiz-results");
  const applications = product => product.applications.split(",").map(value => value.trim()).filter(Boolean);
  let products = [];
  const finishLabels = { Honed: "Soft, low sheen · Honed", Polished: "Glossy, reflective · Polished", Leathered: "Textured · Leathered" };

  function fillOptions(name, values, labels = {}) {
    const select = form.elements[name];
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).forEach(value => {
      select.add(new Option(Object.hasOwn(labels, value) ? labels[value] : value, value));
    });
  }

  const questions = {
    budget: { open: "What would each shortlisted finish cost in my quantity?", limit: "Which options fall within my budget after cutting, packing and transport?", compare: "Can I compare itemised prices for the finishes on my shortlist?" },
    durability: { ordinary: "Is this exact slab and finish appropriate for daily use in my space?", heavy: "What wear or abrasion data is available for this material under heavy use?", wet: "Which finish, slip information and installation details apply in my wet area?" },
    maintenance: { standard: "What is the routine cleaning method for this finish?", low: "Which option needs the least ongoing care in my application?", specialist: "What specialist maintenance or refinishing might this material need?" }
  };

  function rank(product, answers) {
    const reasons = [];
    let score = 0;
    if (answers.application) reasons.push("Lists " + answers.application.toLowerCase() + " as an application");
    if (answers.colour && product.colour === answers.colour) {
      score += 2;
      reasons.push("Matches your " + answers.colour.toLowerCase() + " colour preference");
    }
    if (answers.finish && product.finish === answers.finish) {
      score += 2;
      reasons.push("Matches your " + answers.finish.toLowerCase() + " finish preference");
    }
    if (!reasons.length) reasons.push("An active catalogue option to explore");
    return { product, reasons, score };
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const answers = Object.fromEntries(new FormData(form));
    const matches = products.filter(p => !answers.application || applications(p).includes(answers.application))
      .map(p => rank(p, answers))
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .slice(0, 3);
    form.hidden = true;
    results.hidden = false;
    document.getElementById("quiz-summary").textContent = matches.length
      ? "Up to three catalogue matches, prioritising your chosen colour and finish. Ask the studio to confirm final suitability and pricing."
      : "No current catalogue entries list this application. Retake the quiz with a broader selection or contact the studio.";
    const grid = document.getElementById("quiz-products");
    grid.replaceChildren();
    for (const { product, reasons } of matches) {
      const item = document.createElement("div");
      item.className = "quiz-match";
      item.innerHTML = card(product); // Shared product card escapes database text and supplies wishlist and quote actions.
      const notes = document.createElement("p");
      notes.className = "quiz-reasons";
      notes.textContent = reasons.join(". ") + ". " + [product.colour, product.finish].filter(Boolean).join(" · ");
      item.prepend(notes);
      grid.append(item);
    }
    const list = document.getElementById("followup-questions");
    list.replaceChildren();
    Object.entries(questions).forEach(([key, choices]) => {
      const li = document.createElement("li");
      li.textContent = choices[answers[key]];
      list.append(li);
    });
    syncButtons();
    document.getElementById("shortlist-title").focus();
  });
  document.getElementById("retake").addEventListener("click", () => {
    form.reset();
    results.hidden = true;
    form.hidden = false;
    form.elements.application.focus();
  });
  api("/api/products").then(rows => {
    products = rows;
    if (!rows.length) {
      loading.textContent = "The collection currently has no active products. Please check again later.";
      return;
    }
    fillOptions("application", rows.flatMap(applications));
    fillOptions("colour", rows.map(p => p.colour));
    fillOptions("finish", rows.map(p => p.finish), finishLabels);
    loading.hidden = true;
    form.hidden = false;
  }).catch(error => showError(loading, error));
})();
