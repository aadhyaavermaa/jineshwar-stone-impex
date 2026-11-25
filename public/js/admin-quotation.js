// Browser totals are a preview. The server validates unit rates and charges, calculates
// the authoritative total, and stores each issued version with its customer decision.
function staffMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
    : "—";
}
function staffQuoteSnapshot(q) {
  const summary = {
    quantity: "Quoted quantity",
    quantity_unit: "Quantity unit",
    rate: "Unit rate",
    subtotal: "Material subtotal",
    transport: "Transportation",
    additional: "Additional charges",
    tax_percent: "Tax (%)",
    tax_amount: "Tax amount",
    total: "Final amount",
    valid_until: "Valid through",
    decision: "Customer decision",
    revision_reason: "Revision request",
    terms: "Terms",
    admin_response: "Studio response",
    created_at: "Issued (IST)",
  };
  const values = { ...q };
  for (const key of ["rate", "subtotal", "transport", "additional", "tax_amount", "total"]) {
    if (values[key] != null) values[key] = staffMoney(values[key]);
  }
  return staffDetails(values, summary);
}

function renderStaffQuotation(host, record, onSave) {
  const history = record.quotations || [];
  const latest = history[0];
  const locked = record.status === "Completed" || latest?.decision === "Accepted";
  const qty = Number(record.quantity);
  host.innerHTML = `<div class="desk-heading"><h3>Official quotation</h3>${latest ? statePill(latest.decision) : ""}</div>
    ${
      latest
        ? `<div class="quote-summary"><div><span>Latest issued amount</span><strong>${staffMoney(latest.total)}</strong></div>
      <div><span>Revision ${Number(latest.version)}</span><p>${h(latest.reference_number)}</p></div></div>`
        : ""
    }
    ${history
      .map(
        (
          q,
          i,
        ) => `<details class="quote-history" ${i === 0 ? "open" : ""}><summary>Revision ${Number(q.version)} · ${h(q.decision)} · ${staffMoney(q.total)}</summary>
      ${staffQuoteSnapshot(q)}</details>`,
      )
      .join("")}
    ${
      locked
        ? '<p class="notice">This quotation is closed to further revisions.</p>'
        : `<details class="quote-editor" ${!latest || latest.decision === "Revision Requested" ? "open" : ""}><summary>${latest ? "Prepare a new revision" : "Prepare a quotation"}</summary>
      <form class="formgrid" id="quote-form"><p class="wide">Requested material: <strong>${h(record.product_name)}</strong> · ${h(record.quantity)} ${h(record.quantity_unit)}</p>
      <label>Rate per ${h(record.quantity_unit)} (₹)<input type="number" min="0" max="100000000" step="0.01" required name="rate"></label>
      <label>Transportation (₹)<input type="number" min="0" max="1000000000" step="0.01" required name="transport"></label>
      <label>Additional charges (₹)<input type="number" min="0" max="1000000000" step="0.01" required name="additional"></label>
      <label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" required name="tax_percent"></label>
      <label>Valid through<input type="date" name="valid_until" required></label>
      <label class="wide">Quotation terms<textarea name="terms" rows="3" maxlength="2000"></textarea></label>
      <label class="wide">Customer-visible note<textarea name="admin_response" rows="3" maxlength="2000"></textarea></label>
      <output class="quote-check wide" id="quote-preview" aria-live="polite"></output>
      <div class="wide actions"><button class="btn">${latest ? "Issue revised quotation" : "Issue quotation"}</button></div></form></details>`
    }`;
  const form = host.querySelector("#quote-form");
  if (!form) return;
  const f = form.elements;
  for (const key of [
    "rate",
    "transport",
    "additional",
    "tax_percent",
    "terms",
    "admin_response",
    "valid_until",
  ]) {
    const fallback = ["transport", "additional", "tax_percent"].includes(key) ? 0 : "";
    f[key].value = latest?.[key] ?? fallback;
  }
  f.valid_until.min = indiaDay();
  function preview() {
    const total = host.querySelector("#quote-preview");
    const moneyValues = ["rate", "transport", "additional", "tax_percent"];
    if (moneyValues.some((k) => f[k].value === "" || !f[k].validity.valid)) {
      total.textContent = "Enter the unit rate and charges to preview the quotation.";
      return;
    }
    const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
    const subtotal = round(qty * Number(f.rate.value));
    const base = round(subtotal + Number(f.transport.value) + Number(f.additional.value));
    const tax = round((base * Number(f.tax_percent.value)) / 100);
    total.textContent =
      "Material " +
      staffMoney(subtotal) +
      " · Tax " +
      staffMoney(tax) +
      " · Estimated total " +
      staffMoney(round(base + tax));
  }
  form.addEventListener("input", preview);
  preview();
  form.onsubmit = (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    for (const k of ["rate", "transport", "additional", "tax_percent"]) body[k] = Number(body[k]);
    body.version = Number(latest?.version || 0);
    onSave(
      form,
      () => change("enquiries/" + record.id + "/quotation", "PATCH", body),
      "Quotation issued.",
    );
  };
}
