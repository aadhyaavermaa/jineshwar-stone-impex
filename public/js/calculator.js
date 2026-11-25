(() => {
  const form = document.getElementById("calc");
  const saveForm = document.getElementById("save-project");
  const estimate = document.getElementById("estimate");
  const status = document.getElementById("save-status");
  const params = new URLSearchParams(location.search);
  const field = (name) => form.elements.namedItem(name);
  const projectName = saveForm.elements.namedItem("project_name");
  const editId = params.get("edit");
  const format = (v) => v.toLocaleString("en-IN", { maximumFractionDigits: 6 });
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  let savedId = null;
  let result = null;
  let loading = true;
  function visibleGroup(name, visible) {
    const group = form.querySelector('[data-group="' + name + '"]');
    group.hidden = !visible;
    group.querySelectorAll("input,select").forEach((el) => (el.disabled = !visible));
  }
  function updateControls() {
    const type = field("mode").value;
    const cap = type[0].toUpperCase() + type.slice(1);
    const unit = field("areaUnit").value;
    visibleGroup("area", field("source").value === "area");
    visibleGroup("dimensions", field("source").value === "dimensions");
    visibleGroup("piece", type !== "surface");
    document.getElementById("piece-legend").textContent = cap + " dimensions";
    document.getElementById("piece-length").textContent = cap + " length";
    document.getElementById("piece-width").textContent = cap + " width";
    document.getElementById("known-area-label").textContent = "Surface area (" + unit + ")";
    document.getElementById("area-label").textContent =
      type === "surface" ? "Area & rate unit" : "Area unit";
    document.getElementById("rate-label").textContent =
      "Rate per " + (type === "surface" ? unit : type) + " (₹, optional)";
  }
  function updateQuote() {
    if (!result) return;
    const picker = field("product");
    document.getElementById("to-quote").href = StoneMath.quotationURL(
      field("mode").value,
      result,
      picker.selectedOptions[0]?.dataset.archived ? null : picker.value,
      projectName.value.trim(),
    );
    document.getElementById("print-brand").textContent =
      "Jineshwar Stone Impex · " +
      (projectName.value.trim() || "Material planning sheet") +
      " · " +
      new Date().toLocaleDateString("en-IN", { timeZone: indiaTimeZone });
  }
  function render() {
    updateControls();
    result = null;
    const data = Object.fromEntries(new FormData(form));
    const type = data.mode;
    const buttons = document.getElementById("result-actions");
    try {
      result = StoneMath.calculate(type, data);
    } catch (error) {
      buttons.hidden = true;
      estimate.textContent = error.message;
      return;
    }
    const r = result,
      u = r.inputs.areaUnit,
      picker = field("product");
    const areaText = (v) => format(v) + " " + u;
    const i = r.inputs;
    const rows = [
      [
        "Surface",
        i.source === "area" ? areaText(i.area) : i.length + " × " + i.width + " " + i.unit,
      ],
      ["Surface area", areaText(r.surfaceArea)],
      ["Wastage (" + i.waste + "%)", areaText(r.wastageArea)],
      ["Required area", areaText(r.requiredArea)],
    ];
    if (r.pieceArea !== null) {
      rows.push(
        [
          type === "tile" ? "Tile size" : "Slab size",
          i.pieceLength + " × " + i.pieceWidth + " " + i.pieceUnit,
        ],
        ["Area per " + type, areaText(r.pieceArea)],
      );
    }
    if (picker.value) rows.push(["Selected stone", picker.selectedOptions[0].textContent]);
    if (r.cost !== null)
      rows.push(
        ["Entered rate", money.format(i.rate) + " / " + (type === "surface" ? u : type)],
        ["Estimated material cost", money.format(r.cost)],
      );

    estimate.innerHTML =
      '<p class="planner-amount">' +
      format(r.quantity) +
      "<small>" +
      (type === "surface" ? u : type + (r.quantity === 1 ? "" : "s")) +
      '</small></p><dl class="planner-breakdown">' +
      rows
        .map(
          ([label, value]) =>
            "<div><dt>" + escapeHTML(label) + "</dt><dd>" + escapeHTML(value) + "</dd></div>",
        )
        .join("") +
      "</dl>";
    buttons.hidden = false;
    updateQuote();
  }

  // Only recognized controls are restored. The server repeats all dimensional and ownership checks on save.
  function restore(project) {
    field("mode").value = project.calculation_type;
    for (const [key, val] of Object.entries(project.inputs || {})) {
      if (
        [
          "source",
          "areaUnit",
          "waste",
          "rate",
          "length",
          "width",
          "unit",
          "area",
          "pieceLength",
          "pieceWidth",
          "pieceUnit",
        ].includes(key)
      )
        field(key).value = val ?? "";
    }
    projectName.value = project.project_name || "";
    if (project.product_id) {
      const picker = field("product");
      if (
        ![...picker.options].some((o) => o.value === String(project.product_id)) &&
        project.product_name
      ) {
        const opt = new Option(project.product_name + " (archived)", project.product_id);
        opt.dataset.archived = "1";
        picker.add(opt);
      }
      picker.value = String(project.product_id);
    }
    render();
  }

  form.addEventListener("input", render);
  projectName.addEventListener("input", updateQuote);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    render();
    if (result) message("Estimate updated.");
  });
  form.addEventListener("reset", () => {
    setTimeout(() => {
      status.textContent = "";
      if (!savedId) projectName.value = "";
      render();
    }, 0);
  });
  document.getElementById("print-estimate").addEventListener("click", () => {
    updateQuote();
    window.print();
  });
  saveForm.onsubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    render();
    if (!result) {
      form.reportValidity();
      status.textContent = estimate.textContent;
      return;
    }
    const body = {
      project_name: projectName.value.trim(),
      product_id: field("product").value || null,
      calculation_type: field("mode").value,
      inputs: result.inputs,
    };
    const button = document.getElementById("save-button");
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      const session = await customerReady;
      if (!session.user) {
        try {
          sessionStorage.setItem("jsi-plan-draft", JSON.stringify(body));
        } catch {
          throw Error("Enable session storage to keep this estimate while signing in.");
        }
        location.assign("/login.html?returnTo=" + encodeURIComponent("/calculator.html?draft=1"));
        return;
      }
      const path = "/api/user/projects" + (savedId ? "/" + savedId : "");
      const saved = await api(path, {
        method: savedId ? "PATCH" : "POST",
        headers: { "X-CSRF-Token": session.csrf },
        body: JSON.stringify(body),
      });
      savedId = saved.id;
      history.replaceState(null, "", "/calculator.html?edit=" + saved.id);
      button.textContent = "Save changes";
      status.innerHTML =
        'Project saved. <a href="/dashboard.html?section=projects">View my projects</a>';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };

  async function load() {
    document.getElementById("save-button").disabled = true;
    try {
      const products = await api("/api/products");
      const picker = field("product");
      products.forEach((p) => picker.add(new Option(p.name + " · " + p.product_code, p.id)));
      picker.value = params.get("product") || "";
      if (editId) {
        const p = await api("/api/user/projects/" + encodeURIComponent(editId));
        restore(p);
        savedId = p.id;
        document.getElementById("save-button").textContent = "Save changes";
      } else if (params.get("draft") === "1") {
        const raw = sessionStorage.getItem("jsi-plan-draft");
        if (raw) {
          restore(JSON.parse(raw));
          sessionStorage.removeItem("jsi-plan-draft");
          status.textContent = "Review your estimate and save the project.";
        }
      }
    } catch (error) {
      status.textContent = error.message;
      if (editId) return; // Avoid creating a new record if a requested edit could not be loaded.
    }
    loading = false;
    document.getElementById("save-button").disabled = false;
    render();
  }
  render();
  load();
})();
