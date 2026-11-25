// Small helpers shared by the customer pages. Only the server session identifies a customer.
const customerUI = (() => {
  let snapshot;
  const firstSession =
    typeof customerReady !== "undefined" ? customerReady : api("/api/auth/session");
  async function session(refresh = false) {
    snapshot = refresh ? await api("/api/auth/session") : snapshot || (await firstSession);
    return snapshot;
  }
  async function write(path, method, body = {}) {
    const current = await session();
    return api(path, {
      method,
      headers: { "X-CSRF-Token": current.csrf },
      body: JSON.stringify(body),
    });
  }
  function safeReturn(value) {
    const fallback = "/dashboard.html";
    if (!value) return fallback;
    try {
      const url = new URL(value, location.origin);
      if (
        url.origin !== location.origin ||
        !url.pathname.startsWith("/") ||
        url.username ||
        url.password ||
        /^\/(admin|api)(\/|$)/i.test(url.pathname) ||
        /^\/(login|signup)\.html$/i.test(url.pathname)
      )
        return fallback;
      // A URL such as https://our-host//another-host is same-origin until reduced to a path.
      return url.href;
    } catch {
      return fallback;
    }
  }
  function bindToggles(root = document) {
    root.querySelectorAll(".password-toggle").forEach((button) => {
      button.onclick = () => {
        const field = document.getElementById(button.getAttribute("aria-controls"));
        const show = field.type === "password";
        field.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
        button.setAttribute(
          "aria-label",
          (show ? "Hide " : "Show ") + (field.labels[0]?.textContent || "password"),
        );
      };
    });
  }
  function feedback(node, text, isError = false) {
    node.textContent = text;
    node.style.color = isError ? "#87371f" : "var(--olive)";
  }
  function formData(form) {
    return Object.fromEntries(new FormData(form));
  }
  function validPassword(value) {
    return value.length >= 10 && new TextEncoder().encode(value).length <= 72;
  }
  function passwordMessage(value) {
    return validPassword(value) ? "" : "Use at least 10 characters and at most 72 UTF-8 bytes.";
  }
  async function loadIdentityLibrary() {
    if (window.google?.accounts?.id) return window.google.accounts.id;
    const lib = await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      const timeout = setTimeout(
        () => reject(Error("Google could not be reached. You can continue with email.")),
        12000,
      );
      script.onload = () => {
        clearTimeout(timeout);
        resolve(window.google?.accounts?.id);
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(Error("Google is unavailable. Try again later or use email."));
      };
      document.head.append(script);
    });
    if (!lib) throw Error("Google sign-in is unavailable in this browser.");
    return lib;
  }
  // The official GIS popup returns only the credential. The backend verifies it and its nonce.
  async function googleButton(container, state, onCredential, onError) {
    if (!state.google_client_id) return false;
    if (!window.isSecureContext) throw Error("Google sign-in requires HTTPS or localhost.");
    const id = await loadIdentityLibrary();
    id.initialize({
      client_id: state.google_client_id,
      nonce: state.nonce,
      ux_mode: "popup",
      auto_select: false,
      callback: async (result) => {
        if (!result?.credential)
          return onError(Error("Google sign-in was closed. You can choose another method."));
        try {
          await onCredential(result.credential);
        } catch (error) {
          onError(error);
        }
      },
    });
    container.replaceChildren();
    id.renderButton(container, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
    });
    return true;
  }
  return {
    session,
    write,
    safeReturn,
    bindToggles,
    feedback,
    formData,
    validPassword,
    passwordMessage,
    googleButton,
  };
})();
