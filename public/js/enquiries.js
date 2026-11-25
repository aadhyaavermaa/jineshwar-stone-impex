const request = $("#request"),
  response = $("#response");
const enquiryLabels = {
  quotation: "Quotation request",
  sample_request: "Stone sample request",
  consultancy: "Consultancy request",
  contact: "Contact message",
};
function showReceipt(data, type) {
  const ref = data.reference_number,
    code = data.tracking_code;
  const description = enquiryLabels[type],
    date = new Date().toLocaleDateString("en-IN", { dateStyle: "long", timeZone: indiaTimeZone });
  const text = [
    "Jineshwar Stone Impex",
    description,
    date,
    "Reference number: " + ref,
    ...(code ? ["Private tracking code: " + code] : []),
    "Status: Submitted",
  ].join("\n");
  response.innerHTML =
    '<section class="receipt" tabindex="-1"><span class="receipt-seal" aria-hidden="true">✓</span><p class="eyebrow">Enquiry confirmation</p><h2>Enquiry received.</h2><p>' +
    escapeHTML(description) +
    " · " +
    escapeHTML(date) +
    "</p><p>" +
    (code
      ? "Keep both credentials safe. Use them to track your enquiry or claim it after signing in."
      : "Your request has been automatically saved to your personal dashboard.") +
    '</p><dl class="receipt-codes"><dt>Reference number</dt><dd><code id="receipt-reference"></code><button type="button" class="small-action" id="copy-reference">Copy Reference Number</button></dd>' +
    (code
      ? '<dt>Private tracking code</dt><dd><code id="receipt-code"></code><code class="only-in-receipt-print"></code><span class="receipt-inline"><button type="button" class="small-action" id="toggle-code" aria-controls="receipt-code" aria-pressed="true">Hide code</button><button type="button" class="small-action" id="copy-code">Copy Security Code</button></span></dd>'
      : "") +
    '</dl><div class="receipt-tools"><button class="outline" id="download-receipt">Download Receipt</button><button class="outline" id="print-receipt">Print / save PDF</button></div><div class="actions">' +
    (code
      ? '<a class="btn" href="/track-enquiry.html">Track enquiry</a>'
      : '<a class="btn" href="/dashboard.html?section=enquiries">View My Requests</a>') +
    '<a class="textlink" href="/products.html">Continue Browsing</a></div></section>';
  $("#receipt-reference").textContent = ref;
  $("#copy-reference").onclick = () => copyText(ref, response);
  if (code) {
    $("#receipt-code").textContent = code;
    $(".only-in-receipt-print", response).textContent = code;
    $("#copy-code").onclick = () => copyText(code, response);
    $("#toggle-code").onclick = (e) => {
      const show = e.currentTarget.getAttribute("aria-pressed") !== "true";
      $("#receipt-code").textContent = show ? code : "•••• •••• •••• ••••";
      e.currentTarget.setAttribute("aria-pressed", show);
      e.currentTarget.textContent = show ? "Hide code" : "Show code";
    };
  }
  $("#download-receipt").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([text + "\n"], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = ref + "-receipt.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  $("#print-receipt").onclick = () => window.print();
  document.body.classList.add("receipt-ready");
  $(".receipt").focus();
}
if (request) {
  const f = request.elements,
    submit = $('button[type="submit"],button:not([type])', request);
  const sessionTask = customerReady.then((session) => {
    if (session.authenticated)
      for (const [formKey, userKey] of [
        ["customer_name", "name"],
        ["email", "email"],
        ["phone", "phone"],
      ]) {
        if (!f[formKey].value) f[formKey].value = session.user[userKey] || "";
      }
    return session;
  });
  if (page === "quotation" || page === "sample") {
    submit.disabled = true;
    api("/api/products")
      .then((rows) => {
        const products = page === "sample" ? rows.filter(sampleEligible) : rows;
        products.forEach((p) =>
          f.product_id.add(new Option(p.name + " · " + p.product_code, p.id)),
        );
        f.product_id.value = query.get("product") || "";
        if (!products.length)
          throw Error(
            "There are no eligible materials at present. Please contact the studio.",
          );
        if (page === "quotation") {
          const calculatorLink = $('a[href="/calculator.html"].textlink');
          function carryProduct() {
            if (calculatorLink)
              calculatorLink.href =
                "/calculator.html" +
                (f.product_id.value
                  ? "?product=" + encodeURIComponent(f.product_id.value)
                  : "");
          }
          f.product_id.addEventListener("change", carryProduct);
          carryProduct();
          if (Number(query.get("quantity")) > 0)
            f.quantity.value = query.get("quantity");
          if (["sq ft", "sq m", "pieces"].includes(query.get("unit")))
            f.quantity_unit.value = query.get("unit");
          f.message.value = (query.get("message") || "").slice(0, 3000);
        }
        submit.disabled = false;
      })
      .catch((e) => showError(response, e));
  }
  if (page === "consultancy") {
    f.preferred_date.min = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
    f.required_service.value = query.get("service") || "";
  }
  f.phone.pattern = "[+0-9\\s\\(\\)\\-]{7,30}";
  request.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true;
    response.textContent = "Submitting…";
    try {
      const session = await sessionTask;
      const type = page === "sample" ? "sample_request" : page;
      const body = {
        ...Object.fromEntries(new FormData(request)),
        enquiry_type: type,
      };
      const data = await api("/api/enquiries", {
        method: "POST",
        headers: session.authenticated ? { "X-CSRF-Token": session.csrf } : {},
        body: JSON.stringify(body),
      });
      request.hidden = true;
      showReceipt(data, type);
    } catch (err) {
      showError(response, err);
    } finally {
      submit.disabled = false;
    }
  };
}
const tracking = $("#tracking");
if (tracking) {
  const code = tracking.elements.tracking_code;
  const toggle = $("#tracking-toggle");
  toggle.onclick = () => {
    const show = code.type === "password";
    code.type = show ? "text" : "password";
    toggle.textContent = show ? "Hide" : "Show";
    toggle.setAttribute("aria-label", (show ? "Hide" : "Show") + " private tracking code");
  };
  customerReady.then((session) => {
    if (session === guestSession) throw Error("Account session unavailable.");
    const { authenticated } = session;
    $("#tracking-intro").textContent = authenticated
      ? "Use your reference number to track a request from your account. A security code is unnecessary."
      : "Find your reference number and private tracking code on your enquiry confirmation or receipt.";
    $("#tracking-guest").hidden = authenticated;
    $("#tracking-dashboard").hidden = !authenticated;
    code.disabled = authenticated;
    code.required = !authenticated;
    tracking.hidden = false;
  }).catch((error) => {
    $("#tracking-intro").textContent = "Your account session could not be checked. Refresh to retry.";
    showError(response, error);
  });
  tracking.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      button = $('button[type="submit"]', form);
    button.disabled = true;
    response.textContent = "Checking…";
    try {
      const data = await api("/api/enquiries/track", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      let stages =
        data.enquiry_type === "sample_request"
          ? ["Submitted", "Under Review", "Approved", "Dispatched", "Completed"]
          : ["Submitted", "Under Review", "Quotation Prepared", "Completed"];
      if (["Declined", "Accepted", "Revision Requested"].includes(data.status))
        stages =
          data.enquiry_type === "sample_request"
            ? ["Submitted", "Under Review", data.status]
            : ["Submitted", "Under Review", "Quotation Prepared", data.status];
      const current = stages.indexOf(data.status);
      response.innerHTML =
        '<div class="surface"><h2>' +
        escapeHTML(data.status) +
        '</h2><ol class="tracklist">' +
        stages
          .map(
            (s, i) =>
              '<li class="' +
              (i <= current ? "done" : "") +
              '" ' +
              (i === current ? 'aria-current="step"' : "") +
              ">" +
              escapeHTML(s) +
              (i === current ? " · Current status" : "") +
              "</li>",
          )
          .join("") +
        "</ol>" +
        (data.id
          ? '<a class="outline" href="/dashboard.html?section=enquiries&amp;enquiry=' + Number(data.id) + '">View Details</a>'
          : "") +
        "</div>";
    } catch (err) {
      showError(response, err);
    } finally {
      button.disabled = false;
    }
  };
}
