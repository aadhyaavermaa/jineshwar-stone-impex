(async function customerDashboard() {
  const h = escapeHTML,
    root = document.getElementById("account-content"),
    alert = document.getElementById("account-alert");
  const allSections = Array.from(document.querySelectorAll("[data-account-section]"));
  const allowed = allSections.map((a) => a.dataset.accountSection);
  const section = allowed.includes(query.get("section"))
    ? query.get("section")
    : query.has("enquiry")
      ? "enquiries"
      : "overview";
  const sectionLink = allSections.find((a) => a.dataset.accountSection === section);
  const title = document.getElementById("section-title");
  title.textContent = sectionLink.textContent;
  sectionLink.setAttribute("aria-current", "page");
  const subset = {
    quotations: "quotation",
    consultations: "consultancy",
    samples: "sample_request",
    contacts: "contact",
  };
  const statusBadge = (s) => '<span class="account-state">' + h(s) + "</span>";
  const nothing = (text) => '<p class="account-empty">' + h(text) + "</p>";
  let state;
  try {
    state = await customerUI.session();
    if (!state.user) {
      location.replace(
        "/login.html?returnTo=" + encodeURIComponent(location.pathname + location.search),
      );
      return;
    }
    document.getElementById("sidebar-name").textContent = state.user.name;
    document.querySelector(".customer-monogram").textContent = state.user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase();
    document.getElementById("customer-signout").onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        await customerUI.write("/api/auth/logout", "POST");
        location.replace("/login.html");
      } catch (error) {
        alert.textContent = error.message;
        document.getElementById("customer-signout").disabled = false;
      }
    };
    await draw();
    if (query.get("enquiry")) await requestView.open(Number(query.get("enquiry")), draw);
  } catch (error) {
    showError(root, error);
  } finally {
    root.setAttribute("aria-busy", "false");
  }
  async function draw() {
    alert.textContent = "";
    if (section === "overview") return overview();
    if (section === "profile")
      return customerSettings.renderProfile(root, (await customerUI.session(true)).user);
    if (section === "settings")
      return customerSettings.renderSettings(root, (await customerUI.session(true)).user);
    if (section === "projects") return projects();
    if (section === "notifications") return notifications();
    if (section === "saved") return stones();
    return requests();
  }
  function requestRows(rows) {
    return rows.length
      ? '<div class="account-list">' +
          rows
            .map(
              (r) =>
                '<article class="account-row"><div><h3>' +
                h(r.product_name || requestView.labels[r.enquiry_type] || "Enquiry") +
                '</h3><p class="account-muted">' +
                h(requestView.labels[r.enquiry_type] || "Enquiry") +
                " · " +
                h(r.reference_number) +
                "<br>Submitted " + h(indiaTimestamp(r.created_at)) + " IST" +
                "<br>Last updated " + h(indiaTimestamp(r.updated_at)) + " IST" +
                '</p></div><div class="account-row-actions">' +
                statusBadge(r.status) +
                '<button class="outline" type="button" data-copy-reference="' +
                h(r.reference_number) +
                '">Copy Reference Number</button>' +
                '<button class="outline" type="button" data-request="' +
                Number(r.id) +
                '">' +
                (section === "conversations" ? "Open conversation" : "View details") +
                "</button></div></article>",
            )
            .join("") +
          "</div>"
      : nothing("No requests to display.");
  }
  function bindDetails() {
    root.querySelectorAll("[data-copy-reference]").forEach((button) => {
      button.onclick = () => copyText(button.dataset.copyReference, root);
    });
    root
      .querySelectorAll("[data-request]")
      .forEach((b) => (b.onclick = () => requestView.open(Number(b.dataset.request), draw)));
  }
  async function overview() {
    const stats = await api("/api/user/stats");
    const metrics = {
      total_requests: "Total requests",
      active_enquiries: "Active enquiries",
      completed_enquiries: "Completed enquiries",
      pending_quotations: "Pending quotations",
      consultancy_requests: "Consultations",
      sample_requests: "Sample requests",
      saved_products: "Saved stones",
      saved_projects: "Saved projects",
    };
    root.innerHTML =
      (state.user.google_linked && !state.user.phone
        ? '<p class="account-empty">Add a phone number so the studio can follow up on your enquiries. <a class="account-textlink" href="/dashboard.html?section=profile">Complete my profile</a></p>'
        : "") +
      '<div class="account-metrics">' +
      Object.entries(metrics)
        .map(
          ([key, label]) =>
            '<div class="account-metric"><strong>' +
            h(stats[key]) +
            "</strong><span>" +
            label +
            "</span></div>",
        )
        .join("") +
      "</div>" +
      '<div class="account-actions"><a class="btn" href="/calculator.html">Create a project</a><a class="outline" href="/products.html">Browse stones</a><a class="outline" href="/quotation.html">Request a quotation</a><a class="outline" href="/contact.html">Contact the studio</a></div>' +
      '<section class="account-block"><h2>Recent activity</h2>' +
      requestRows(stats.recent || []) +
      '</section><section id="recent-account" class="account-block"></section>';
    bindDetails();
    if (typeof renderRecentProducts === "function")
      await renderRecentProducts(document.getElementById("recent-account"));
  }
  async function requests() {
    const rows = await api("/api/user/enquiries");
    const options = (values, text) =>
      '<option value="">' +
      text +
      "</option>" +
      values.map(([v, l]) => '<option value="' + h(v) + '">' + h(l) + "</option>").join("");
    const chosen = subset[section];
    const filteredType = chosen ? rows.filter((r) => r.enquiry_type === chosen) : rows;
    const statuses = [...new Set(filteredType.map((r) => r.status))].sort();
    root.innerHTML =
      '<div class="account-filter"><label>Search by reference number<input type="search" id="filter-reference" maxlength="100"></label>' +
      (chosen
        ? ""
        : '<label>Request type<select id="filter-type">' +
          options(Object.entries(requestView.labels), "All Requests") +
          "</select></label>") +
      '<label>Status<select id="filter-status">' +
      options(
        statuses.map((s) => [s, s]),
        "All statuses",
      ) +
      "</select></label>" +
      '<label>Sort by submission date<select id="filter-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><label>From date<input type="date" id="filter-from"></label><label>Through date<input type="date" id="filter-to"></label><button type="button" class="outline" id="clear-filters">Reset</button></div>' +
      '<div class="account-block" id="request-rows"></div>' +
      (section === "enquiries"
        ? '<details class="account-block"><summary>Add Previous Guest Request</summary><p>Use both credentials from your original receipt.</p>' +
          '<form class="account-form" id="claim-request"><label for="claim-ref">Reference number</label><input id="claim-ref" name="reference_number" required maxlength="100">' +
          '<label for="claim-token">Private tracking code</label><input id="claim-token" type="password" name="tracking_code" required maxlength="100" autocomplete="off">' +
          '<button type="submit" class="btn">Save enquiry to my account</button><p class="account-feedback" role="status"></p></form></details>'
        : "");
    const reference = root.querySelector("#filter-reference"),
      sort = root.querySelector("#filter-sort"),
      type = root.querySelector("#filter-type"),
      status = root.querySelector("#filter-status"),
      from = root.querySelector("#filter-from"),
      to = root.querySelector("#filter-to");
    function update() {
      const search = reference.value.trim().toUpperCase();
      const visible = filteredType.filter(
        (r) =>
          r.reference_number.toUpperCase().includes(search) &&
          (!type?.value || r.enquiry_type === type.value) &&
          (!status.value || r.status === status.value) &&
          (!from.value || requestView.date(r.created_at) >= from.value) &&
          (!to.value || requestView.date(r.created_at) <= to.value),
      );
      const direction = sort.value === "oldest" ? 1 : -1;
      visible.sort((a, b) => direction * (parseTimestamp(a.created_at) - parseTimestamp(b.created_at) || a.id - b.id));
      root.querySelector("#request-rows").innerHTML =
        from.value && to.value && from.value > to.value
          ? nothing("Choose a through date on or after the start date.")
          : visible.length
            ? requestRows(visible)
            : nothing(filteredType.length ? "No requests match your filters." : "Your requests will appear here.");
      bindDetails();
    }
    root.querySelector(".account-filter").oninput = update;
    root.querySelector("#clear-filters").onclick = () => {
      [reference, type, status, from, to].filter(Boolean).forEach((el) => (el.value = ""));
      sort.value = "newest";
      update();
    };
    update();
    const claim = root.querySelector("#claim-request");
    if (claim)
      claim.onsubmit = async (e) => {
        e.preventDefault();
        const b = claim.querySelector("button");
        b.disabled = true;
        try {
          await customerUI.write("/api/user/enquiries/claim", "POST", customerUI.formData(claim));
          message("Enquiry saved to your account.");
          await requests();
        } catch (error) {
          customerUI.feedback(claim.querySelector(".account-feedback"), error.message, true);
        } finally {
          b.disabled = false;
        }
      };
  }
  async function stones() {
    const rows = await api("/api/user/wishlist");
    root.innerHTML = rows.length
      ? '<div class="cards">' + rows.map(card).join("") + "</div>"
      : nothing("Your saved stones will appear here.") +
        '<div class="account-actions"><a class="btn" href="/products.html">Explore the collection</a></div>';
    syncButtons();
    document.addEventListener(
      "selectionchange-jsi",
      () => stones().catch((error) => showError(root, error)),
      { once: true },
    );
  }
  function projectInfo(p) {
    const i = p.inputs;
    return requestView.definitionList([
      ["Project type", p.calculation_type],
      ["Material", p.product_name || "Undecided"],
      [
        "Surface dimensions",
        i.source === "dimensions"
          ? i.length + " × " + i.width + " " + i.unit
          : i.area + " " + i.areaUnit,
      ],
      [
        "Piece dimensions",
        i.pieceLength ? i.pieceLength + " × " + i.pieceWidth + " " + i.pieceUnit : null,
      ],
      ["Wastage", i.waste + "%"],
      ["Rate entered", i.rate != null ? requestView.currency(i.rate) : "No rate entered"],
      ["Estimated requirement", p.estimated_quantity + " " + p.quantity_unit],
      [
        "Planning estimate",
        p.estimated_cost != null ? requestView.currency(p.estimated_cost) : "No rate entered",
      ],
      ["Created (IST)", indiaTimestamp(p.created_at)],
      ["Updated (IST)", indiaTimestamp(p.updated_at)],
    ]);
  }
  async function projects() {
    const rows = await api("/api/user/projects");
    root.innerHTML =
      '<div class="account-actions"><a class="btn" href="/calculator.html">Create a project</a></div>' +
      (rows.length
        ? rows
            .map(
              (p) =>
                '<article class="account-block"><h3>' +
                h(p.project_name) +
                '</h3><p class="account-muted">' +
                h(p.product_name || "Material undecided") +
                " · " +
                h(requestView.date(p.updated_at)) +
                "</p>" +
                "<details><summary>View planning estimate</summary>" +
                projectInfo(p) +
                '</details><div class="account-actions">' +
                '<a class="outline" href="/calculator.html?edit=' +
                Number(p.id) +
                '">Edit</a><button class="outline" type="button" data-duplicate="' +
                Number(p.id) +
                '">Duplicate</button>' +
                '<a class="btn" href="' +
                h(p.quotation_url) +
                '">Convert to quotation request</a><button type="button" class="outline" data-delete="' +
                Number(p.id) +
                '">Delete</button></div></article>',
            )
            .join("")
        : nothing("Save a named estimate from the stone calculator to start a project."));
    root.querySelectorAll("[data-duplicate]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            await customerUI.write(
              "/api/user/projects/" + b.dataset.duplicate + "/duplicate",
              "POST",
            );
            message("Project duplicated.");
            await projects();
          } catch (error) {
            alert.textContent = error.message;
          } finally {
            b.disabled = false;
          }
        }),
    );
    root.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = Number(b.dataset.delete),
            p = rows.find((x) => x.id === id);
          const dialog = document.getElementById("account-dialog");
          document.getElementById("dialog-title").textContent = "Delete project?";
          document.getElementById("dialog-feedback").textContent = "";
          document.getElementById("dialog-content").innerHTML =
            "<p>" +
            h(p.project_name) +
            ' will be removed from your saved estimates.</p><div class="account-actions"><button type="button" class="btn" id="confirm-delete">Delete project</button><button type="button" class="outline" id="cancel-delete">Keep project</button></div>';
          document.getElementById("cancel-delete").onclick = () => dialog.close();
          document.getElementById("close-account-dialog").onclick = () => dialog.close();
          document.getElementById("confirm-delete").onclick = async (e) => {
            const button = e.currentTarget;
            button.disabled = true;
            try {
              await customerUI.write("/api/user/projects/" + id, "DELETE");
              dialog.close();
              message("Project deleted.");
              await projects();
            } catch (error) {
              document.getElementById("dialog-feedback").textContent = error.message;
            } finally {
              button.disabled = false;
            }
          };
          dialog.showModal();
        }),
    );
  }
  async function notifications() {
    const rows = await api("/api/user/notifications"),
      unread = rows.filter((n) => !n.is_read).length;
    document.dispatchEvent(new CustomEvent("jsi-notifications-changed", { detail: unread }));
    root.innerHTML =
      (unread
        ? '<button class="outline" type="button" id="read-all">Mark all as read</button>'
        : "") +
      (rows.length
        ? rows
            .map(
              (n) =>
                '<article class="account-row"><div><strong>' +
                h(n.message) +
                '</strong><p class="account-muted">' +
                h(indiaTimestamp(n.created_at)) +
                " IST · " +
                (n.is_read ? "Read" : "Unread") +
                '</p></div><div class="account-row-actions">' +
                (n.enquiry_id
                  ? '<a class="outline" href="/dashboard.html?section=enquiries&amp;enquiry=' +
                    Number(n.enquiry_id) +
                    '">View enquiry</a>'
                  : "") +
                (n.is_read
                  ? ""
                  : '<button type="button" class="outline" data-read="' +
                    Number(n.id) +
                    '">Mark as read</button>') +
                "</div></article>",
            )
            .join("")
        : nothing("Updates about your enquiries and quotations will appear here."));
    async function read(button, route) {
      button.disabled = true;
      try {
        await customerUI.write("/api/user/notifications/" + route, "PATCH");
        await notifications();
      } catch (error) {
        alert.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }
    root
      .querySelectorAll("[data-read]")
      .forEach((b) => (b.onclick = () => read(b, b.dataset.read + "/read")));
    if (unread) root.querySelector("#read-all").onclick = (e) => read(e.currentTarget, "read-all");
  }
})();
