const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const indiaTimeZone = "Asia/Kolkata";
const indiaDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: indiaTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const indiaClockFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: indiaTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function parseTimestamp(value) {
  // Interpret older offset-free timestamps as UTC. Stored IST timestamps carry +05:30.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value))
    return new Date(value.replace(" ", "T") + "Z");
  return value == null || value === "" ? new Date(NaN) : new Date(typeof value === "string" ? value.replace(" ", "T") : value);
}
function indiaDay(value = new Date()) {
  const date = parseTimestamp(value);
  if (!Number.isFinite(+date)) return "";
  const parts = Object.fromEntries(indiaDayFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}
function indiaTimestamp(value) {
  const date = parseTimestamp(value);
  return Number.isFinite(+date) ? indiaDay(date) + " " + indiaClockFormatter.format(date) : "—";
}
const icon = (name) =>
  '<img class="icon" alt="" src="/icons/' + name + '.svg">';
const query = new URLSearchParams(location.search);
const page = location.pathname.split("/").pop().replace(".html", "") || "index";
const brand =
  '<a class="brand" href="/index.html" aria-label="Jineshwar Stone Impex home"><i class="brandmark" aria-hidden="true"></i><span><strong>Jineshwar</strong><small>Stone Impex</small></span></a>';
const link = (url, label) =>
  '<a href="/' +
  url +
  '.html" ' +
  (url === page ? 'aria-current="page"' : "") +
  ">" +
  label +
  "</a>";
const urls = {
  Home: "index",
  Collection: "products",
  Services: "services",
  Gallery: "gallery",
  About: "about",
  Contact: "contact",
};
const links = Object.entries(urls)
  .map(([label, url]) => link(url, label))
  .join("");
const studioLinks = [
  ["visualizer", "Stone visualizer", "panels-top-left"],
  ["quiz", "Find your perfect stone", "sparkles"],
  ["moodboard", "Material moodboard", "grid-2x2"],
  ["before-after", "Before and after", "images"],
  ["calculator", "Stone calculator", "ruler"],
  ["care", "Stone care guide", "book-open"],
];
const dashboardLinks = [
  ["overview", "My dashboard"],
  ["enquiries", "My enquiries"],
  ["quotations", "My quotations"],
  ["saved", "My saved stones"],
  ["projects", "My projects"],
  ["profile", "My profile"],
  ["notifications", "Notifications"],
];
const guestSession = { authenticated: false, user: null, csrf: null };
let currentCustomer = guestSession;
let accountWishes = [];
const header = $("#site-header");
if (header) {
  const studioMenu =
    '<details class="navdrop"><summary>Design Studio ' +
    icon("chevron-down") +
    '</summary><div class="drop-panel">' +
    studioLinks
      .map(([url, label, img]) => link(url, icon(img) + label))
      .join("") +
    "</div></details>";
  const companyMenu =
    '<details class="navdrop"><summary>Company ' +
    icon("chevron-down") +
    '</summary><div class="drop-panel">' +
    link("about", "About us") +
    link("services", "Services") +
    link("contact", "Contact us") +
    "</div></details>";
  header.outerHTML =
    '<a class="skip" href="#main">Skip to content</a><div class="topbar"><div class="wrap"><span>NATURAL STONE &amp; MARBLE HANDICRAFTS</span>' +
    link("track-enquiry", "Track enquiry") +
    '</div></div><header class="mast"><div class="wrap">' +
    brand +
    '<nav class="nav" id="mainnav" aria-label="Main navigation">' +
    link("index", "Home") +
    link("products", "Collection") +
    studioMenu +
    link("gallery", "Gallery") +
    companyMenu +
    '</nav><div class="navtools"><a href="/wishlist.html" class="saved" aria-label="Wishlist">' +
    icon("heart") +
    '<small id="wishcount">0</small></a><a class="compare-nav" href="/compare.html" aria-label="Compare products">' +
    icon("scale") +
    '</a><div id="account-nav" class="account-nav"></div><button class="iconbtn mobile" aria-label="Navigation menu" aria-expanded="false" aria-controls="mainnav">' +
    icon("menu") +
    "</button></div></div></header>";
  $(".mobile").onclick = (e) =>
    e.currentTarget.setAttribute(
      "aria-expanded",
      $("#mainnav").classList.toggle("open"),
    );
  document.addEventListener("click", (e) => {
    $$(".mast details[open]").forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    });
    if (!e.target.closest(".mast") && $("#mainnav").classList.contains("open"))
      $(".mobile").click();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = $(".mast details[open]");
    if (open) {
      open.open = false;
      $("summary", open).focus();
    } else if ($("#mainnav").classList.contains("open")) {
      $(".mobile").click();
      $(".mobile").focus();
    }
  });
  $("#site-footer").innerHTML =
    '<div class="wrap"><div>' +
    brand +
    '<nav aria-label="Explore">' +
    links +
    '</nav><nav aria-label="Studio tools">' +
    link("visualizer", "Stone visualizer") +
    link("calculator", "Stone calculator") +
    link("consultancy", "Book consultancy") +
    link("wishlist", "Wishlist") +
    link("compare", "Compare materials") +
    link("brochure", "Create a brochure") +
    link("track-enquiry", "Track an enquiry") +
    '</nav><nav aria-label="Contact links"><a href="https://www.instagram.com/jineshwarstoneimpex/">Instagram</a><a href="https://www.linkedin.com/company/jineshwar-stone-impex">LinkedIn</a><a href="https://wa.me/919315331055">WhatsApp</a><a href="/admin/login.html">Admin login</a></nav></div><small>Jineshwar Stone Impex · New Delhi, India<button type="button" class="outline backtop">Back to top</button></small></div>';
  $(".backtop").onclick = () => window.scrollTo({ top: 0 });
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const err = Error(data.error || "Unable to load data.");
    err.status = response.status;
    err.code = data.code;
    throw err;
  }
  return data;
}
async function copyText(text, host) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      message("Copied to clipboard.");
      return;
    } catch {}
  }
  const manual = document.createElement("textarea");
  manual.value = text;
  manual.readOnly = true;
  manual.className = "copy-fallback";
  manual.setAttribute("aria-label", "Text to copy");
  host.append(manual);
  manual.focus();
  manual.select();
  message("Press Ctrl+C or use your device’s Copy command.");
  manual.onblur = () => manual.remove();
}
function message(text) {
  let box = $("#toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.className = "toast";
    box.setAttribute("role", "status");
    document.body.append(box);
  }
  box.textContent = text;
  box.hidden = false;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => (box.hidden = true), 3000);
}
function browserIds(key) {
  try {
    const ids = JSON.parse(localStorage.getItem("jsi-" + key) || "[]");
    return Array.isArray(ids)
      ? [...new Set(ids.filter((n) => Number.isSafeInteger(n) && n > 0))]
      : [];
  } catch {
    return [];
  }
}
function saved(key) {
  return key === "wish" && currentCustomer.authenticated
    ? [...accountWishes]
    : browserIds(key);
}
function storeIds(key, ids) {
  if (key === "wish" && currentCustomer.authenticated) accountWishes = [...ids];
  else localStorage.setItem("jsi-" + key, JSON.stringify(ids));
  syncButtons();
}
function syncButtons() {
  if ($("#wishcount")) $("#wishcount").textContent = saved("wish").length;
  $$("[data-save]").forEach((b) => {
    const selected = saved(b.dataset.save).includes(Number(b.dataset.id));
    b.setAttribute("aria-pressed", selected);
    b.title =
      (selected ? "Remove from " : "Add to ") +
      (b.dataset.save === "wish" ? "wishlist" : "comparison");
    b.setAttribute("aria-label", b.title);
  });
}
function renderCustomerNav(unread = 0) {
  const nav = $("#account-nav");
  if (!nav) return;
  if (!currentCustomer.authenticated) {
    const dest =
      page === "login" || page === "signup"
        ? ""
        : "?return=" +
          encodeURIComponent(
            location.pathname + location.search + location.hash,
          );
    nav.innerHTML =
      '<a class="guest-login" href="/login.html' +
      dest +
      '">Log in</a><a class="btn guest-signup" href="/signup.html' +
      dest +
      '">Sign up</a>';
    return;
  }
  nav.innerHTML =
    '<a class="bell-nav" href="/dashboard.html?section=notifications" aria-label="Notifications, ' +
    Number(unread) +
    ' unread">' +
    icon("bell") +
    (unread ? "<small>" + Number(unread) + "</small>" : "") +
    '</a><details class="navdrop profile-drop"><summary>' +
    icon("user-round") +
    "<span>" +
    escapeHTML(currentCustomer.user.name.split(" ")[0]) +
    "</span>" +
    icon("chevron-down") +
    '</summary><div class="drop-panel">' +
    dashboardLinks
      .map(
        ([section, label]) =>
          '<a href="/dashboard.html?section=' + section + '">' + label + "</a>",
      )
      .join("") +
    '<button type="button" id="account-logout">Log out</button></div></details>';
  $("#account-logout").onclick = async (e) => {
    e.target.disabled = true;
    try {
      await api("/api/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": currentCustomer.csrf },
      });
      location.assign("/index.html");
    } catch (err) {
      message(err.message);
      e.target.disabled = false;
    }
  };
}
async function refreshCustomerState() {
  const session = await api("/api/auth/session");
  currentCustomer = session;
  renderCustomerNav();
  if (session.authenticated) {
    const rows = await api("/api/user/wishlist");
    const known = new Set(rows.map((p) => Number(p.id)));
    // A guest selection is removed locally only after a successful merge, or if archived.
    const guestIds = browserIds("wish");
    for (const id of guestIds) {
      if (!known.has(id)) {
        try {
          await api("/api/user/wishlist", {
            method: "POST",
            headers: { "X-CSRF-Token": session.csrf },
            body: JSON.stringify({ product_id: id }),
          });
          known.add(id);
        } catch (err) {
          if (err.status !== 404 && err.status !== 400) throw err;
        }
      }
      localStorage.setItem(
        "jsi-wish",
        JSON.stringify(browserIds("wish").filter((x) => x !== id)),
      );
    }
    accountWishes = [...known];
    api("/api/user/notifications")
      .then((rows) => renderCustomerNav(rows.filter((n) => !n.is_read).length))
      .catch(() => {});
  } else accountWishes = [];
  syncButtons();
  document.dispatchEvent(new Event("selectionchange-jsi"));
  return currentCustomer;
}
renderCustomerNav();
const customerReady = header
  ? refreshCustomerState().catch((err) => {
      message("Account details could not be loaded. Refresh to retry.");
      return currentCustomer;
    })
  : Promise.resolve(guestSession);
document.addEventListener("jsi-notifications-changed", (e) =>
  renderCustomerNav(Number(e.detail) || 0),
);
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-save]");
  if (!b) return;
  const key = b.dataset.save,
    id = Number(b.dataset.id);
  b.disabled = true;
  try {
    await customerReady;
    const ids = saved(key),
      exists = ids.includes(id);
    if (!exists && key === "compare" && ids.length >= 3)
      return message(
        "Compare up to three products. Remove one to add another.",
      );
    if (key === "wish" && currentCustomer.authenticated) {
      await api("/api/user/wishlist" + (exists ? "/" + id : ""), {
        method: exists ? "DELETE" : "POST",
        headers: { "X-CSRF-Token": currentCustomer.csrf },
        ...(exists ? {} : { body: JSON.stringify({ product_id: id }) }),
      });
    }
    storeIds(
      key,
      exists ? ids.filter((x) => x !== id) : [...new Set([...saved(key), id])],
    );
    message(
      exists
        ? "Selection removed."
        : key === "wish"
          ? "Saved to your wishlist."
          : "Added to comparison.",
    );
    document.dispatchEvent(new Event("selectionchange-jsi"));
  } catch (err) {
    message(err.message || "Could not update selection.");
  } finally {
    b.disabled = false;
  }
});
syncButtons();
window.addEventListener("storage", () => {
  syncButtons();
  document.dispatchEvent(new Event("selectionchange-jsi"));
});
function saveButton(key, id) {
  return (
    '<button class="iconbtn" type="button" data-save="' +
    key +
    '" data-id="' +
    Number(id) +
    '" aria-label="' +
    (key === "wish" ? "Wishlist" : "Compare") +
    '">' +
    icon(key === "wish" ? "heart" : "scale") +
    "</button>"
  );
}
function sampleEligible(p) {
  return !/handicraft|furniture/i.test(p.category);
}
function card(p) {
  const h = escapeHTML,
    id = Number(p.id),
    detail = "/product-details.html?id=" + id;
  return (
    '<article class="card material-card"><div class="card-visual"><a class="photo" href="' +
    detail +
    '"><img loading="lazy" src="' +
    h(p.image_url) +
    '" alt="' +
    h(p.name) +
    '"></a><div class="photo-tools">' +
    saveButton("wish", id) +
    saveButton("compare", id) +
    '</div></div><div class="cardbody"><div class="material-meta"><span class="tag">' +
    h(p.category) +
    '</span><span class="material-code">' +
    h(p.product_code) +
    '</span></div><h3><a href="' +
    detail +
    '">' +
    h(p.name) +
    "</a></h3><p>" +
    h(p.description) +
    '</p><span class="availability">' +
    h(p.availability) +
    '</span><div class="card-controls"><a class="outline" href="' +
    detail +
    '">View details</a><a class="btn" href="/quotation.html?product=' +
    id +
    '">Request quote</a></div><div class="material-extras">' +
    (sampleEligible(p)
      ? '<a href="/sample.html?product=' + id + '">Request a sample</a>'
      : "") +
    '<a href="/brochure.html?add=' +
    id +
    '">Add to brochure</a></div></div></article>'
  );
}
document.addEventListener(
  "error",
  (e) => {
    if (e.target instanceof HTMLImageElement && !e.target.dataset.fallback) {
      e.target.dataset.fallback = "1";
      e.target.src = "/images/marble.webp";
      e.target.alt = "Illustrative marble texture";
    }
  },
  true,
);
const empty = (text, url = "products", label = "Explore collection") =>
  '<div class="empty wide"><h3>' +
  escapeHTML(text) +
  '</h3><div class="actions">' +
  link(url, label) +
  "</div></div>";
function showError(el, error) {
  el.innerHTML =
    '<div class="notice error" role="alert">' +
    escapeHTML(error.message) +
    "</div>";
}
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("seen");
        observer.unobserve(e.target);
      }
    }),
  );
  $$(".reveal").forEach((el) => observer.observe(el));
}

// Recently viewed IDs belong to this browser, regardless of customer sign-in.
function rememberProduct(id) {
  try {
    localStorage.setItem(
      "jsi-recent",
      JSON.stringify(
        [id, ...browserIds("recent").filter((x) => x !== id)].slice(0, 8),
      ),
    );
  } catch {}
}
async function renderRecentProducts(container, products) {
  if (!container) return;
  const ids = browserIds("recent");
  if (!ids.length) {
    container.hidden = true;
    return;
  }
  try {
    const current = products || (await api("/api/products"));
    const recent = ids
      .map((id) => current.find((p) => p.id === id))
      .filter(Boolean);
    container.hidden = !recent.length;
    if (!recent.length) return;
    container.innerHTML =
      '<div class="section-head"><div><h2>Recently viewed</h2><p class="muted">Your browsing history on this device.</p></div><button type="button" class="outline clear-history">Clear history</button></div><div class="recent-grid">' +
      recent
        .map(
          (p) =>
            '<a class="recent-item" href="/product-details.html?id=' +
            Number(p.id) +
            '"><img src="' +
            escapeHTML(p.image_url) +
            '" alt="" loading="lazy"><span>' +
            escapeHTML(p.name) +
            "</span></a>",
        )
        .join("") +
      "</div>";
    $(".clear-history", container).onclick = () => {
      try {
        localStorage.removeItem("jsi-recent");
        container.replaceChildren();
        container.hidden = true;
        message("Browsing history cleared.");
      } catch {
        message("Your browser could not clear the history.");
      }
    };
  } catch {
    container.hidden = true;
  }
}
if (page === "index") renderRecentProducts($("#recent-products"));
