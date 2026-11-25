async function setupBrochure() {
  if (typeof customerReady !== "undefined") await customerReady;
  const products = await api("/api/products");
  const byId = new Map(products.map((p) => [p.id, p]));
  let ids = Array.from(new Set(saved("brochure"))).filter((id) => byId.has(id));
  const select = $("#brochure-product"),
    items = $("#brochure-items");
  products.forEach((p) =>
    select.add(Studio.option(p.id, p.name + " · " + p.product_code)),
  );
  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: indiaTimeZone });
  $("#edition-date").textContent = "Prepared " + date.format(new Date());
  function render() {
    items.replaceChildren();
    if (!ids.length)
      items.innerHTML = empty(
        "Your brochure is empty. Choose a product above.",
      );
    ids.forEach((id) => {
      const p = byId.get(id),
        article = document.createElement("section");
      article.className = "brochure-item";
      const fields = {
        Reference: p.product_code,
        Category: p.category,
        Colour: p.colour,
        Finish: p.finish,
        Origin: p.origin,
        Dimensions: p.dimensions,
        Applications: p.applications,
        Availability: p.availability,
      };
      article.innerHTML =
        '<img src="' +
        escapeHTML(p.image_url) +
        '" alt="' +
        escapeHTML(p.name) +
        '"><div><h3>' +
        escapeHTML(p.name) +
        "</h3><p>" +
        escapeHTML(p.description) +
        "</p><dl>" +
        Object.entries(fields)
          .filter(([, value]) => value)
          .map(
            ([key, value]) =>
              "<dt>" + key + "</dt><dd>" + escapeHTML(value) + "</dd>",
          )
          .join("") +
        '</dl><button class="outline" type="button">Remove product</button></div>';
      article.querySelector("button").onclick = () => {
        ids = ids.filter((value) => value !== id);
        commit();
      };
      items.append(article);
    });
    $("#print-brochure").disabled = !ids.length;
    $("#add-product").disabled = !products.length;
    Studio.status(
      ids.length +
        " product" +
        (ids.length === 1 ? "" : "s") +
        " in this brochure.",
    );
  }
  function commit() {
    try {
      localStorage.setItem("jsi-brochure", JSON.stringify(ids));
    } catch {
      message(
        "Browser storage is unavailable. You can still print this selection.",
      );
    }
    render();
  }
  function add(more) {
    const previous = ids.length;
    ids = Array.from(new Set([...ids, ...more.filter((id) => byId.has(id))]));
    commit();
    if (ids.length === previous) message("No new active products to add.");
  }
  const addId = query.get("add"),
    source = query.get("from");
  if (addId || source) {
    const imports =
      source === "wishlist"
        ? saved("wish")
        : source === "compare"
          ? saved("compare")
          : [];
    if (addId) imports.push(Number(addId));
    add(imports);
    history.replaceState(null, "", location.pathname);
  } else render();
  $("#add-product").onclick = () => add([Number(select.value)]);
  $("#add-wishlist").onclick = () => add(saved("wish"));
  $("#print-brochure").onclick = async () => {
    await Promise.allSettled(
      Array.from(items.querySelectorAll("img"), (img) => img.decode()),
    );
    window.print();
  };
}
setupBrochure().catch((e) => Studio.status(e.message));
