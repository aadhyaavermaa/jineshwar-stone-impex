const statuses = [
  "Submitted",
  "Under Review",
  "Approved",
  "Dispatched",
  "Quotation Prepared",
  "Accepted",
  "Revision Requested",
  "Completed",
  "Declined",
];
const typeNames = {
  quotation: "Quotation",
  consultancy: "Consultation",
  sample_request: "Stone sample",
  contact: "Contact message",
};
const statePill = (state) => '<span class="state-pill">' + h(state) + "</span>";
const workspace = $("#workspace"),
  feedback = $("#feedback"),
  h = escapeHTML;
let csrfToken = "";
function report(err) {
  feedback.textContent = err.message;
}
async function change(url, method, data) {
  return api("/api/admin/" + url, {
    method,
    headers: { "X-CSRF-Token": csrfToken },
    body: JSON.stringify(data || {}),
  });
}
const options = (values) =>
  values.map((v) => '<option value="' + h(v) + '">' + h(v) + "</option>").join("");
if (page === "login") {
  const form = $("#login"),
    button = $("button", form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    feedback.textContent = "";
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const session = await api("/api/admin/session");
      if (!session.authenticated)
        throw Error("The browser could not keep your sign-in session. Check that cookies are enabled and try again.");
      location.assign("/admin/dashboard.html");
    } catch (err) {
      report(err instanceof TypeError ? Error("Could not reach the server. Try signing in again.") : err);
      button.disabled = false;
    }
  };
  button.disabled = false;
} else {
  boot().catch(report);
}
async function boot() {
  const session = await api("/api/admin/session");
  if (!session.authenticated) {
    location.replace("/admin/login.html");
    return;
  }
  csrfToken = session.csrf;
  $(".rail-toggle").onclick = (e) => {
    const expanded = $(".sidebar").classList.toggle("expanded");
    e.currentTarget.setAttribute("aria-expanded", String(expanded));
  };
  $$(".sidebar nav a")
    .find((a) => a.pathname + a.search === location.pathname + location.search)
    ?.setAttribute("aria-current", "page");
  $("#logout").onclick = async () => {
    try {
      await change("logout", "POST");
      location.replace("/admin/login.html");
    } catch (err) {
      report(err);
    }
  };
  if (page === "dashboard") await dashboard();
  if (page === "products") await productManager();
  if (page === "enquiries") await enquiryManager();
  if (page === "customers") await customerManager();
}

function rowDate(value) {
  return indiaTimestamp(value);
}

function enquiryTable(rows) {
  if (!rows.length) return '<p class="notice">No enquiries match this view.</p>';
  return `<div class="scrollbox"><table><thead><tr><th>Customer</th><th>Request</th>
          <th>Submitted (IST)</th><th>Status</th><th>Details</th></tr></thead><tbody>
          ${rows
            .map(
              (
                e,
              ) => `<tr><td><strong>${h(e.customer_name)}</strong><small>${e.user_id ? "Registered" : "Guest"}</small></td>
            <td>${h(typeNames[e.enquiry_type] || e.enquiry_type)}${e.product_name ? "<small>" + h(e.product_name) + "</small>" : ""}</td>
            <td>${h(rowDate(e.created_at))}</td><td>${statePill(e.status)}</td>
            <td><a class="textlink" href="/admin/enquiries.html?id=${encodeURIComponent(e.id)}">Open enquiry</a></td></tr>`,
            )
            .join("")}
          </tbody></table></div>`;
}

async function dashboard() {
  const d = await api("/api/admin/stats");
  const metrics = {
    total_enquiries: "Total enquiries",
    pending_enquiries: "Pending enquiries",
    completed_enquiries: "Completed enquiries",
    total_customers: "Registered customers",
    sample_requests: "Sample requests",
    accepted_quotations: "Accepted quotations",
    total_products: "Active products",
    available_products: "Available products",
    consultancy_requests: "Consultations",
  };
  const months = Array.from({ length: 6 }, (_, i) => {
    const [year, month] = indiaDay().split("-").map(Number);
    return new Date(Date.UTC(year, month - 6 + i, 1))
      .toISOString()
      .slice(0, 7);
  });
  const counts = months.map((month) => d.monthly.find((row) => row.month === month)?.count || 0);
  const monthLabels = months.map((month) =>
    new Date(month + "-01T12:00:00Z").toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: indiaTimeZone,
    }),
  );
  const dist = d.distribution;
  const activity = d.recent_activity || [];
  workspace.innerHTML = `<div class="metrics">${Object.entries(metrics)
    .map(
      ([key, label]) =>
        '<div class="metric"><span>' + label + "</span><strong>" + h(d[key]) + "</strong></div>",
    )
    .join("")}</div>
    <div class="actions desk-actions"><a class="btn" href="/admin/enquiries.html?status=pending">Review pending enquiries</a><a class="outline" href="/admin/products.html?add=1">Add a product</a></div>
    <div class="desk-columns"><section class="surface"><h2>Monthly enquiries</h2>
    <div class="chart-frame"><canvas id="chart" role="img" aria-label="${h(monthLabels.map((m, i) => m + " " + counts[i]).join(", "))}"></canvas></div></section>
    <section class="surface"><h2>By status</h2>${dist.length ? '<ul class="desk-list">' + dist.map((r) => "<li><span>" + h(r.status) + "</span><strong>" + h(r.count) + "</strong></li>").join("") + "</ul>" : '<p class="muted">No enquiries yet.</p>'}</section></div>
    <section><div class="desk-heading"><h2>Recent enquiries</h2><a class="textlink" href="/admin/enquiries.html">View all</a></div>${enquiryTable(d.recent)}</section>
    <section><h2>Recent customer activity</h2>${
      activity.length
        ? '<ul class="activity-list">' +
          activity
            .map(
              (a) =>
                "<li><div><strong>" +
                h(a.customer_name || "Customer") +
                "</strong><span>" +
                h(a.event) +
                "</span></div><time>" +
                h(rowDate(a.created_at)) +
                " IST</time>" +
                (a.enquiry_id
                  ? '<a class="textlink" href="/admin/enquiries.html?id=' +
                    encodeURIComponent(a.enquiry_id) +
                    '">Open</a>'
                  : "") +
                "</li>",
            )
            .join("") +
          "</ul>"
        : '<p class="notice">Activity will appear as customers use the studio.</p>'
    }</section>`;
  new Chart($("#chart"), {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: "Enquiries",
          data: counts,
          backgroundColor: "#3a5142",
          borderRadius: 2,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

const productFields = {
  name: "Product name",
  product_code: "Unique product code",
  category: "Category",
  description: "Description",
  colour: "Colour",
  finish: "Finish",
  origin: "Origin",
  dimensions: "Dimensions or thickness",
  applications: "Applications (comma-separated)",
  image_url: "Local image path or HTTPS URL",
  availability: "Availability",
};
const maxLengths = {
  name: 120,
  product_code: 50,
  category: 80,
  description: 2400,
  colour: 80,
  finish: 80,
  origin: 120,
  dimensions: 120,
  applications: 300,
  image_url: 1000,
};
async function productManager() {
  let rows = await api("/api/admin/products"),
    editing = null;
  workspace.innerHTML =
    '<div class="filterbar"><label>Search products<input id="term" type="search"></label><label>Category<select id="family"><option value="">All categories</option></select></label><label>Visibility<select id="visibility"><option value="">All products</option><option value="1">Active</option><option value="0">Archived</option></select></label><button id="add" class="btn">Add product</button></div><div class="section scrollbox" id="rows"></div><dialog id="editor" aria-labelledby="edit-title"><h2 id="edit-title"></h2><form id="product-form" class="formgrid"></form><p class="error" id="edit-error" role="alert"></p></dialog>';
  const form = $("#product-form");
  form.innerHTML =
    Object.entries(productFields)
      .map(
        ([k, label]) =>
          "<label>" +
          label +
          (k === "availability"
            ? '<select name="availability">' +
              options(["Available", "Made to order", "On request"]) +
              "</select>"
            : k === "description"
              ? '<textarea required name="description" maxlength="2400"></textarea>'
              : '<input required maxlength="' + maxLengths[k] + '" name="' + k + '">') +
          "</label>",
      )
      .join("") +
    '<label class="checklabel"><input type="checkbox" name="is_featured">Featured</label><label class="checklabel"><input type="checkbox" name="is_active">Active in catalogue</label><div class="actions wide"><button class="btn">Save product</button><button type="button" id="cancel" class="outline">Cancel</button></div>';
  function families() {
    const old = $("#family").value;
    $("#family").innerHTML =
      '<option value="">All categories</option>' +
      options([...new Set(rows.map((p) => p.category))].sort());
    $("#family").value = old;
  }
  function draw() {
    const term = $("#term").value.toLowerCase();
    const list = rows.filter(
      (p) =>
        (p.name + " " + p.product_code).toLowerCase().includes(term) &&
        (!$("#family").value || p.category === $("#family").value) &&
        (!$("#visibility").value || String(p.is_active) === $("#visibility").value),
    );
    $("#rows").innerHTML = list.length
      ? "<table><thead><tr><th>Code / name</th><th>Category</th><th>Availability</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>" +
        list
          .map(
            (p) =>
              "<tr><td>" +
              h(p.product_code) +
              "<br>" +
              h(p.name) +
              "</td><td>" +
              h(p.category) +
              "</td><td>" +
              h(p.availability) +
              "</td><td>" +
              (p.is_active ? "Active" : "Archived") +
              '</td><td><button class="outline" data-edit="' +
              p.id +
              '">Edit</button> ' +
              (p.is_active
                ? '<button class="outline" data-archive="' + p.id + '">Archive</button>'
                : "") +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table>"
      : '<p class="notice">No matching products.</p>';
  }
  function edit(p) {
    editing = p;
    form.reset();
    $("#edit-error").textContent = "";
    $("#edit-title").textContent = p ? "Edit product" : "Add product";
    for (const k of Object.keys(productFields))
      form.elements[k].value = p?.[k] || (k === "availability" ? "Available" : "");
    form.elements.is_active.checked = p ? Boolean(p.is_active) : true;
    form.elements.is_featured.checked = Boolean(p?.is_featured);
    $("#editor").showModal();
  }
  // Archiving removes a product from public browsing, while keeping existing requests intact.
  const confirmation = document.createElement("dialog");
  confirmation.setAttribute("aria-labelledby", "archive-heading");
  confirmation.innerHTML =
    '<h2 id="archive-heading">Archive product?</h2><p id="archive-summary"></p><div class="actions"><button class="outline" type="button" data-cancel>Keep product</button><button class="btn" type="button" data-confirm>Archive product</button></div><p class="error" role="alert"></p>';
  workspace.append(confirmation);
  let pendingArchive;
  confirmation.querySelector("[data-cancel]").onclick = () => confirmation.close();
  confirmation.querySelector("[data-confirm]").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await change("products/" + pendingArchive, "DELETE");
      rows = await api("/api/admin/products");
      draw();
      confirmation.close();
      message("Product archived.");
    } catch (err) {
      confirmation.querySelector(".error").textContent = err.message;
    } finally {
      button.disabled = false;
    }
  };
  $("#add").onclick = () => edit(null);
  $("#cancel").onclick = () => $("#editor").close();
  $(".filterbar").oninput = draw;
  $("#rows").onclick = async (e) => {
    const editId = e.target.dataset.edit,
      archive = e.target.dataset.archive;
    if (editId) edit(rows.find((p) => p.id === Number(editId)));
    if (archive) {
      const product = rows.find((p) => p.id === Number(archive));
      if (!product) return;
      pendingArchive = product.id;
      confirmation.querySelector(".error").textContent = "";
      confirmation.querySelector("#archive-summary").textContent =
        product.name +
        " will be hidden from the catalogue. Its enquiry history will stay available.";
      confirmation.showModal();
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = $("button", form);
    button.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(form));
      body.is_active = form.elements.is_active.checked;
      body.is_featured = form.elements.is_featured.checked;
      await change("products" + (editing ? "/" + editing.id : ""), editing ? "PUT" : "POST", body);
      rows = await api("/api/admin/products");
      families();
      draw();
      $("#editor").close();
      message("Product saved.");
    } catch (err) {
      $("#edit-error").textContent = err.message;
    } finally {
      button.disabled = false;
    }
  };
  families();
  draw();
  if (query.get("add")) edit(null);
}
