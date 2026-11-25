// The detail dialog reads one owner-scoped enquiry and its conversation.
const requestView = (() => {
  const h = escapeHTML;
  const labels = {
    quotation: "Quotation request",
    consultancy: "Consultation",
    sample_request: "Stone sample",
    contact: "Contact message",
  };
  const currency = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
      Number(value || 0),
    );
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  function date(value) {
    return value ? indiaDay(value) : "—";
  }
  function definitionList(items) {
    return (
      '<dl class="account-details">' +
      items
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => "<div><dt>" + h(k) + "</dt><dd>" + h(v) + "</dd></div>")
        .join("") +
      "</dl>"
    );
  }
  function quoteSheet(q) {
    const line = (name, n) => "<tr><td>" + h(name) + "</td><td>" + h(currency(n)) + "</td></tr>";
    return (
      '<article class="quote-sheet"><div class="eyebrow">Jineshwar Stone Impex</div><h2>Quotation</h2>' +
      definitionList([
        ["Quotation reference", q.reference_number],
        ["Revision", q.version],
        ["Enquiry", q.enquiry_reference],
        ["Prepared for", q.customer_name],
        ["Material", q.product_name],
        ["Quantity", q.quantity + " " + q.quantity_unit],
        ["Valid through", q.valid_until],
        ["Decision", q.decision || "Awaiting response"],
      ]) +
      '<table class="quote-amounts"><caption>Quotation breakdown in INR</caption><tbody>' +
      line("Rate per " + q.quantity_unit, q.rate) +
      line("Material subtotal", q.subtotal) +
      line("Transportation", q.transport) +
      line("Additional charges", q.additional) +
      line("Tax (" + Number(q.tax_percent || 0) + "%)", q.tax_amount) +
      line("Total", q.total) +
      "</tbody></table>" +
      (q.terms ? '<h3>Terms</h3><p class="quote-note">' + h(q.terms) + "</p>" : "") +
      (q.admin_response
        ? '<h3>Studio response</h3><p class="quote-note">' + h(q.admin_response) + "</p>"
        : "") +
      (q.revision_reason
        ? '<h3>Revision request</h3><p class="quote-note">' + h(q.revision_reason) + "</p>"
        : "") +
      "</article>"
    );
  }
  function threadMarkup(messages) {
    return messages.length
      ? messages
          .map(
            (m) =>
              '<article class="thread-message ' +
              (m.sender_type === "customer" ? "mine" : "") +
              '"><small>' +
              h(m.sender_type === "customer" ? "You" : "Stone studio") +
              " · " +
              h(indiaTimestamp(m.created_at)) +
              " IST</small><p>" +
              h(m.message) +
              "</p></article>",
          )
          .join("")
      : '<p class="account-muted">Your conversation starts here.</p>';
  }
  let refreshListing = () => {};
  let currentId = 0,
    version = 0;
  function opened(id, v) {
    return currentId === id && version === v && document.getElementById("account-dialog").open;
  }
  async function open(id, onChange = refreshListing) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) return;
    currentId = Number(id);
    refreshListing = onChange;
    const v = ++version;
    const dialog = document.getElementById("account-dialog");
    const panel = document.getElementById("dialog-content");
    const feedback = document.getElementById("dialog-feedback");
    document.getElementById("dialog-title").textContent = "Request details";
    document.getElementById("close-account-dialog").onclick = () => dialog.close();
    panel.textContent = "Loading the request…";
    feedback.textContent = "";
    if (!dialog.open) dialog.showModal();
    dialog.onclose = () => {
      currentId = 0;
      version++;
      panel.replaceChildren();
      feedback.textContent = "";
      document.body.classList.remove("print-quotation");
    };
    try {
      const [r, messages] = await Promise.all([
        api("/api/user/enquiries/" + id),
        api("/api/user/enquiries/" + id + "/messages"),
      ]);
      if (!opened(Number(id), v)) return;
      const quotes = r.quotations || [];
      const q = quotes[0];
      const canRespond =
        q &&
        (!q.decision ||
          ["pending", "awaiting response", "prepared"].includes(
            String(q.decision).toLowerCase(),
          )) &&
        r.status === "Quotation Prepared";
      document.getElementById("dialog-title").textContent =
        labels[r.enquiry_type] || "Request details";
      panel.innerHTML =
        definitionList([
          ["Reference number", r.reference_number],
          ["Status", r.status],
          ["Submitted", date(r.created_at)],
          ["Product", r.product_name],
          ["Quantity", r.quantity != null ? r.quantity + " " + (r.quantity_unit || "") : null],
          ["Customer", r.customer_name],
          ["Email", r.email],
          ["Phone", r.phone],
          ["Project type", r.project_type],
          ["Delivery location", r.delivery_location],
          ["Delivery address", r.delivery_address || r.sample_address],
          ["City", r.city || r.sample_city],
          ["Postal code", r.postal_code || r.sample_postal_code],
          ["Application", r.intended_application || r.application],
          ["Service", r.required_service],
          ["Material", r.preferred_material],
          ["Budget", r.budget],
          ["Preferred date", r.preferred_date],
          ["Requirements", r.message],
          ["Studio response", r.admin_response],
        ]) +
        (q
          ? '<section id="quotation-print">' +
            quoteSheet(q) +
            '</section><div class="account-actions"><button class="outline" type="button" id="quote-print">Print / save quotation as PDF</button></div>'
          : "") +
        (q && q.valid_until < today()
          ? '<p class="account-muted">The validity period has ended.</p>'
          : "") +
        (canRespond
          ? '<form class="account-form" id="quote-decision"><label for="decision">Your quotation response</label><select id="decision" name="decision" required><option value="">Select a response</option>' +
            (q.valid_until >= today() ? '<option value="accept">Accept quotation</option>' : "") +
            '<option value="decline">Decline quotation</option><option value="request-revision">Request a revision</option></select><label for="revision-note" hidden>What should change?</label><textarea id="revision-note" name="reason" hidden maxlength="2000"></textarea><small>Acceptance confirms interest in this proposal. Payment and fulfilment are arranged separately.</small><button class="btn" type="submit">Confirm response</button></form>'
          : "") +
        (quotes.length > 1
          ? "<details><summary>Earlier quotation revisions (" +
            (quotes.length - 1) +
            ")</summary>" +
            quotes.slice(1).map(quoteSheet).join("") +
            "</details>"
          : "") +
        '<section class="account-block"><h3>Conversation</h3><div class="message-thread" id="customer-thread">' +
        threadMarkup(messages) +
        '</div><form class="account-form" id="send-message"><label for="message-draft">Message to the studio</label><textarea id="message-draft" required maxlength="2000" rows="3" name="message"></textarea><button class="btn" type="submit">Send message</button></form></section>';
      const thread = document.getElementById("customer-thread");
      thread.scrollTop = thread.scrollHeight;
      const print = document.getElementById("quote-print");
      if (print)
        print.onclick = () => {
          document.body.classList.add("print-quotation");
          window.addEventListener(
            "afterprint",
            () => document.body.classList.remove("print-quotation"),
            { once: true },
          );
          window.print();
        };
      const decision = document.getElementById("quote-decision");
      if (decision) {
        const reason = decision.elements.reason;
        decision.elements.decision.onchange = () => {
          const show = decision.elements.decision.value === "request-revision";
          reason.hidden = !show;
          reason.required = show;
          reason.labels[0].hidden = !show;
        };
        decision.onsubmit = async (event) => {
          event.preventDefault();
          await act(decision.querySelector("button"), async () => {
            const action = decision.elements.decision.value;
            await customerUI.write(
              "/api/user/quotations/" + q.id + "/" + action,
              "POST",
              action === "request-revision" ? { reason: reason.value } : {},
            );
            message("Quotation response saved.");
            await refreshListing();
            await open(id);
          });
        };
      }
      const form = document.getElementById("send-message");
      form.onsubmit = async (event) => {
        event.preventDefault();
        await act(form.querySelector("button"), async () => {
          await customerUI.write("/api/user/enquiries/" + id + "/messages", "POST", {
            message: form.elements.message.value.trim(),
          });
          form.reset();
          thread.innerHTML = threadMarkup(await api("/api/user/enquiries/" + id + "/messages"));
          thread.scrollTop = thread.scrollHeight;
          message("Message sent.");
        });
      };
    } catch (error) {
      if (opened(Number(id), v)) {
        panel.textContent = "";
        customerUI.feedback(feedback, error.message, true);
      }
    }
    async function act(button, work) {
      button.disabled = true;
      feedback.textContent = "";
      try {
        await work();
      } catch (error) {
        customerUI.feedback(feedback, error.message, true);
      } finally {
        button.disabled = false;
      }
    }
  }
  return { open, labels, currency, date, definitionList };
})();
