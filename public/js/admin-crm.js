// The API selects fields using the signed-in administrator's session. Escape customer text
// at the point of display and show only the fields needed for each desk task.
function staffDetails(record, fields) {
  return (
    '<dl class="specs desk-specs">' +
    Object.entries(fields)
      .filter(([key]) => record[key] !== null && record[key] !== undefined && record[key] !== "")
      .map(([key, label]) => "<dt>" + h(label) + "</dt><dd>" + h(key === "created_at" ? rowDate(record[key]) : record[key]) + "</dd>")
      .join("") +
    "</dl>"
  );
}
function staffDialogClose() {
  return '<button type="button" class="outline" data-close>Close</button>';
}

async function customerManager() {
  const customers = await api("/api/admin/customers");
  const thisMonth = indiaDay().slice(0, 7);
  const registrations = customers.filter(customer => indiaDay(customer.created_at).startsWith(thisMonth)).length;
  const requesting = customers.filter(customer => customer.request_count > 0).length;
  workspace.innerHTML = `<div class="metrics">
    <div class="metric"><span>Registered customers</span><strong>${customers.length}</strong></div>
    <div class="metric"><span>Joined this month (IST)</span><strong>${registrations}</strong></div>
    <div class="metric"><span>Customers with requests</span><strong>${requesting}</strong></div></div>
    <div class="filterbar"><label>Search customers<input type="search" id="customer-search" placeholder="Name or email"></label></div>
    <p class="results" id="customer-count" role="status"></p><div id="customer-rows" class="scrollbox"></div>
    <dialog id="history" aria-labelledby="customer-heading"><div class="desk-heading"><h2 id="customer-heading">Customer history</h2>${staffDialogClose()}</div>
    <div id="customer-record" aria-live="polite"></div></dialog>`;
  function draw() {
    const term = $("#customer-search").value.toLowerCase().trim();
    const list = customers.filter((c) => (c.name + " " + c.email).toLowerCase().includes(term));
    $("#customer-count").textContent =
      list.length + (list.length === 1 ? " registered customer" : " registered customers");
    $("#customer-rows").innerHTML = list.length
      ? `<table><thead><tr><th>Customer</th><th>Email</th><th>Registered (IST)</th><th>Requests</th><th>History</th></tr></thead>
      <tbody>${list
        .map(
          (
            c,
          ) => `<tr><td>${h(c.name)}</td><td>${h(c.email)}</td><td>${h(rowDate(c.created_at))}</td><td>${h(c.request_count)}</td>
      <td><button class="outline" data-customer="${Number(c.id)}">View history</button></td></tr>`,
        )
        .join("")}</tbody></table>`
      : '<p class="notice">No registered customers match this view.</p>';
  }
  $("#customer-search").oninput = draw;
  $("#history [data-close]").onclick = () => $("#history").close();
  let selectedId;
  $("#customer-rows").onclick = async (event) => {
    const button = event.target.closest("[data-customer]");
    if (!button) return;
    const customer = customers.find((c) => c.id === Number(button.dataset.customer));
    if (!customer) return;
    selectedId = customer.id;
    $("#customer-heading").textContent = customer.name;
    $("#customer-record").textContent = "Loading customer history…";
    $("#history").showModal();
    try {
      const rows = await api("/api/admin/customers/" + customer.id + "/enquiries");
      if (selectedId !== customer.id) return;
      $("#customer-record").innerHTML =
        staffDetails(customer, {
          email: "Account email",
          phone: "Profile phone",
          created_at: "Registered (IST)",
        }) +
        "<h3>Request history</h3>" +
        enquiryTable(rows);
    } catch (err) {
      if (selectedId === customer.id) $("#customer-record").textContent = err.message;
    }
  };
  draw();
}

function staffAllowedStatuses(record) {
  if (record.enquiry_type === "sample_request")
    return ["Submitted", "Under Review", "Approved", "Dispatched", "Completed", "Declined"];
  // Only customers decide on a proposal. Staff may complete the job after acceptance.
  const latest = record.quotations?.[0];
  if (latest) {
    return latest.decision === "Accepted" && record.status !== "Completed"
      ? [record.status, "Completed"]
      : [record.status];
  }
  return Array.from(new Set([record.status, "Submitted", "Under Review", "Completed"]));
}

function contactLinks(record) {
  const subject = "Jineshwar Stone Impex · " + record.reference_number;
  const email =
    "mailto:" + encodeURIComponent(record.email) + "?subject=" + encodeURIComponent(subject);
  const telephone = "tel:" + String(record.phone).replace(/[^+0-9]/g, "");
  return (
    '<div class="actions contact-tools"><a class="outline" href="' +
    h(email) +
    '">Reply via email</a>' +
    '<a class="outline" href="' +
    h(telephone) +
    '">Call customer</a><button type="button" class="outline" id="copy-contact">Copy contact details</button></div>'
  );
}

function conversationBody(messages) {
  return messages.length
    ? messages
        .map((m) => {
          const staff = m.sender_type === "admin";
          return (
            '<article class="thread-message ' +
            (staff ? "from-staff" : "from-customer") +
            '"><header><strong>' +
            (staff ? "Studio" : "Customer") +
            "</strong><time>" +
            h(rowDate(m.created_at)) +
            " IST</time></header><p>" +
            h(m.message) +
            "</p></article>"
          );
        })
        .join("")
    : '<p class="muted">No messages in this enquiry yet.</p>';
}

async function enquiryManager() {
  let rows = await api("/api/admin/enquiries");
  let selectedId = 0,
    generation = 0;
  const initialType = query.get("type") || "";
  const titles = {
    quotation: "Quotation requests",
    sample_request: "Stone sample requests",
    contact: "Contact messages",
    consultancy: "Consultancy requests",
  };
  if (titles[initialType]) $("h1").textContent = titles[initialType];
  workspace.innerHTML = `<form class="filterbar desk-filters" id="filter-form" role="search">
    <label>Search requests<input type="search" id="term" placeholder="Name, product or reference"></label>
    <label>Request type<select id="type"><option value="">All types</option>${Object.entries(
      typeNames,
    )
      .map(([value, name]) => '<option value="' + value + '">' + name + "</option>")
      .join("")}</select></label>
    <label>Status<select id="state"><option value="">All statuses</option><option value="pending">Pending</option>${options(statuses)}</select></label>
    <label>From (IST)<input type="date" id="date-from"></label><label>Through (IST)<input type="date" id="date-to"></label>
    <button type="reset" class="outline">Clear filters</button></form>
    <p class="results" id="result-count" aria-live="polite"></p><div id="rows"></div>
    <dialog id="enquiry" aria-labelledby="enquiry-title"><div class="desk-heading"><div><div class="eyebrow">Enquiry file</div>
    <h2 id="enquiry-title">Enquiry details</h2></div>${staffDialogClose()}</div>
    <div id="record" aria-live="polite"></div><p id="record-error" role="alert"></p></dialog>`;
  $("#type").value = initialType;
  $("#state").value = query.get("status") || "";
  const dialog = $("#enquiry");
  function draw() {
    const term = $("#term").value.toLowerCase().trim(),
      from = $("#date-from").value,
      to = $("#date-to").value;
    $("#date-from").max = to;
    $("#date-to").min = from;
    const state = $("#state").value,
      type = $("#type").value;
    const filtered = rows.filter((r) => {
      const day = indiaDay(r.created_at);
      return (
        [r.customer_name, r.reference_number, r.product_name]
          .join(" ")
          .toLowerCase()
          .includes(term) &&
        (!type || type === r.enquiry_type) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!state ||
          (state === "pending"
            ? !["Completed", "Declined"].includes(r.status)
            : state === r.status))
      );
    });
    $("#result-count").textContent =
      filtered.length + (filtered.length === 1 ? " request" : " requests");
    $("#rows").innerHTML = enquiryTable(filtered);
  }
  $("#filter-form").onsubmit = (e) => e.preventDefault();
  $("#filter-form").oninput = draw;
  $("#filter-form").onreset = () => setTimeout(draw, 0);
  $("#rows").onclick = (e) => {
    const a = e.target.closest("a");
    if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      openRecord(new URL(a.href).searchParams.get("id"));
    }
  };
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    selectedId = 0;
    generation++;
  });
  async function reloadList() {
    rows = await api("/api/admin/enquiries");
    draw();
  }
  async function openRecord(id) {
    selectedId = Number(id);
    const version = ++generation;
    if (!dialog.open) {
      $("#record").textContent = "Opening enquiry…";
      dialog.showModal();
    }
    $("#record-error").textContent = "";
    try {
      const r = await api("/api/admin/enquiries/" + encodeURIComponent(id));
      const thread = r.user_id ? await api("/api/admin/enquiries/" + r.id + "/messages") : [];
      if (version !== generation || !dialog.open) return;
      $("#enquiry-title").textContent = r.customer_name;
      const summary = {
        reference_number: "Enquiry reference",
        product_name: "Selected product",
        product_code: "Product code",
        quantity: "Requested quantity",
        quantity_unit: "Unit",
        project_type: "Project type",
        delivery_location: "Delivery location",
        city: "City",
        postal_code: "Postal code",
        application: "Intended application",
        preferred_material: "Preferred material",
        required_service: "Required service",
        budget: "Budget",
        preferred_date: "Preferred consultation date",
        email: "Email",
        phone: "Phone",
        created_at: "Submitted (IST)",
        message: "Customer requirements",
      };
      $("#record").innerHTML =
        `<div class="record-tags"><span>${h(typeNames[r.enquiry_type])}</span><span>${r.user_id ? "Registered customer" : "Guest enquiry"}</span>${statePill(r.status)}</div>
        ${staffDetails(r, summary)}${contactLinks(r)}
        <section class="desk-record-section"><h3>Request update</h3><form id="update" class="stack">
        <label>Current status<select name="status">${options(staffAllowedStatuses(r))}</select></label>
        <label>Customer-visible response<textarea name="admin_response" maxlength="2000" rows="3"></textarea></label>
        <button class="btn">Save update</button></form></section>
        ${r.enquiry_type === "quotation" ? '<section id="proposal" class="desk-record-section"></section>' : ""}
        <section class="desk-record-section"><h3>Conversation</h3>${
          r.user_id
            ? '<div class="thread-list" id="thread" aria-label="Conversation messages">' +
              conversationBody(thread) +
              '</div><form class="stack" id="reply"><label>Reply to customer<textarea name="message" maxlength="2000" rows="3" required></textarea></label><button class="btn">Send reply</button></form>'
            : '<p class="muted">Account conversations become available when the customer claims this guest enquiry. Use the contact details above to follow up.</p>'
        }</section>`;
      const form = $("#update");
      form.elements.status.value = r.status;
      form.elements.admin_response.value = r.admin_response || "";
      const copy = $("#copy-contact");
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText([r.customer_name, r.email, r.phone].join("\n"));
          message("Contact details copied.");
        } catch {
          $("#record-error").textContent =
            "Clipboard access is unavailable. Select and copy the contact details above.";
        }
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        save(
          form,
          () => change("enquiries/" + r.id, "PATCH", Object.fromEntries(new FormData(form))),
          "Enquiry updated.",
        );
      };
      const reply = $("#reply");
      if (reply)
        reply.onsubmit = (e) => {
          e.preventDefault();
          const text = reply.elements.message.value.trim();
          if (!text) {
            reply.elements.message.focus();
            return;
          }
          save(
            reply,
            () => change("enquiries/" + r.id + "/messages", "POST", { message: text }),
            "Reply sent.",
          );
        };
      if ($("#thread")) $("#thread").scrollTop = $("#thread").scrollHeight;
      if ($("#proposal")) renderStaffQuotation($("#proposal"), r, save);
    } catch (err) {
      if (version === generation) $("#record-error").textContent = err.message;
    }
  }
  async function save(form, write, success) {
    const detail = selectedId,
      buttons = Array.from(form.querySelectorAll("button"));
    buttons.forEach((b) => (b.disabled = true));
    $("#record-error").textContent = "";
    try {
      await write();
      message(success);
      await reloadList();
      if (detail === selectedId && dialog.open) await openRecord(detail);
    } catch (err) {
      if (selectedId === detail) $("#record-error").textContent = err.message;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  draw();
  if (query.get("id")) await openRecord(query.get("id"));
}
