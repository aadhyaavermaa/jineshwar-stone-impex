async function loadDetail() {
  const id = query.get("id");
  if (!/^\d+$/.test(id || ""))
    throw Error("Choose a valid product from the collection.");
  const p = await api("/api/products/" + id),
    h = escapeHTML;
  rememberProduct(p.id);
  document.title = p.name + " | Jineshwar Stone Impex";
  const fields = {
    product_code: "Product code",
    category: "Material / family",
    colour: "Colour",
    finish: "Surface finish",
    origin: "Origin",
    dimensions: "Thickness / dimensions",
    applications: "Suitable applications",
    availability: "Availability",
  };
  $("#detail").innerHTML =
    '<div class="story"><img src="' +
    h(p.image_url) +
    '" alt="' +
    h(p.name) +
    '"><div><div class="eyebrow">' +
    h(p.category) +
    "</div><h1>" +
    h(p.name) +
    '</h1><p class="intro">' +
    h(p.description) +
    "</p>" +
    (p.product_code.startsWith("DEMO-")
      ? '<p class="muted">Demonstration product · Illustrative specifications.</p>'
      : "") +
    '<dl class="specs">' +
    Object.entries(fields)
      .map(([key, label]) => "<dt>" + label + "</dt><dd>" + h(p[key]) + "</dd>")
      .join("") +
    '</dl><div class="actions"><a class="btn" href="/quotation.html?product=' +
    p.id +
    '">Request a Quote</a>' +
    saveButton("wish", p.id) +
    saveButton("compare", p.id) +
    '</div><div class="detail-links">' +
    (sampleEligible(p)
      ? '<a class="textlink" href="/sample.html?product=' +
        p.id +
        '">Request a sample</a>'
      : "") +
    '<a class="textlink" href="/brochure.html?add=' +
    p.id +
    '">Add to brochure</a><a class="textlink" href="/care.html?material=' +
    encodeURIComponent(p.category) +
    '">Stone care guide</a></div></div></div>';
  syncButtons();
  const catalogue = await api("/api/products");
  renderRecentProducts($("#recent-products"), catalogue);
  const related = catalogue.filter(
    (row) => row.category === p.category && row.id !== p.id,
  );
  if (related.length) {
    $("#related").innerHTML =
      '<div class="section-head"><h2>Related pieces</h2></div><div class="cards">' +
      related.map(card).join("") +
      "</div>";
    syncButtons();
  }
}
loadDetail().catch((e) => showError($("#detail"), e));
