let catalogue = [];
const filterKeys = ["category", "colour", "finish", "applications"];
function setupFilters() {
  for (const key of filterKeys) {
    const options = new Set(
      catalogue.flatMap((p) =>
        key === "applications"
          ? p[key].split(",").map((x) => x.trim())
          : [p[key]],
      ),
    );
    Array.from(options)
      .sort()
      .forEach((v) => $("#" + key).add(new Option(v, v)));
  }
  $("#category").value = query.get("category") || "";
  $(".filterbar").addEventListener("input", render);
  $("#reset").onclick = () => {
    $$(".filterbar input,.filterbar select").forEach((el) => (el.value = ""));
    render();
  };
}
function comparison(rows) {
  if (!rows.length) return empty("No materials selected for comparison.");
  const header = rows
    .map(
      (p) =>
        '<th scope="col"><img loading="lazy" src="' +
        escapeHTML(p.image_url) +
        '" alt=""><a href="/product-details.html?id=' +
        p.id +
        '">' +
        escapeHTML(p.name) +
        "</a><div>" +
        saveButton("compare", p.id) +
        "</div></th>",
    )
    .join("");
  const fields = {
    category: "Category",
    colour: "Colour",
    finish: "Finish",
    origin: "Origin",
    dimensions: "Dimensions",
    applications: "Applications",
    availability: "Availability",
  };
  const body = Object.entries(fields)
    .map(
      ([key, label]) =>
        '<tr><th scope="row">' +
        label +
        "</th>" +
        rows.map((p) => "<td>" + escapeHTML(p[key]) + "</td>").join("") +
        "</tr>",
    )
    .join("");
  return (
    "<table><caption>Selected material specifications</caption><thead><tr><th>Material</th>" +
    header +
    "</tr></thead><tbody>" +
    body +
    '</tbody></table><div class="actions"><button class="outline" id="clear">Clear comparison</button></div>'
  );
}
function render() {
  let rows = [...catalogue];
  if (page === "products") {
    const term = $("#search").value.toLowerCase().trim();
    rows = rows.filter(
      (p) =>
        [p.name, p.product_code, p.category, p.description]
          .join(" ")
          .toLowerCase()
          .includes(term) &&
        filterKeys.every((k) => {
          const chosen = $("#" + k).value;
          return (
            !chosen ||
            (k === "applications"
              ? p[k]
                  .split(",")
                  .map((x) => x.trim())
                  .includes(chosen)
              : p[k] === chosen)
          );
        }),
    );
    const sort = $("#sort").value;
    if (sort)
      rows.sort(
        (a, b) => a.name.localeCompare(b.name) * (sort === "asc" ? 1 : -1),
      );
  } else {
    const ids = saved(page === "wishlist" ? "wish" : "compare");
    rows = ids.map((id) => catalogue.find((p) => p.id === id)).filter(Boolean);
    if (rows.length !== ids.length)
      storeIds(
        page === "wishlist" ? "wish" : "compare",
        rows.map((p) => p.id),
      );
  }
  $("#count").textContent =
    rows.length + " material" + (rows.length === 1 ? "" : "s");
  $("#listing").innerHTML =
    page === "compare"
      ? comparison(rows)
      : rows.length
        ? rows.map(card).join("")
        : page === "wishlist"
          ? empty("Your wishlist is empty.")
          : '<div class="empty wide"><h3>No matching materials</h3><p>Try another finish or reset your filters.</p></div>';
  if ($("#clear"))
    $("#clear").onclick = () => {
      storeIds("compare", []);
      render();
    };
  syncButtons();
}
Promise.all([api("/api/products"), customerReady])
  .then(([data]) => {
    catalogue = data;
    if (page === "products") {
      setupFilters();
      renderRecentProducts($("#recent-products"), catalogue);
    }
    if (page === "wishlist" && currentCustomer.authenticated)
      $(".page-head .intro").textContent =
        "These materials are saved in your customer account.";
    render();
    document.addEventListener("selectionchange-jsi", render);
  })
  .catch((e) => showError($("#listing"), e));
