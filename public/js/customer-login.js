(async function customerLogin() {
  const form = document.getElementById("customer-auth");
  const signup = form.dataset.mode === "signup";
  const submit = document.getElementById("auth-submit");
  const feedback = document.getElementById("auth-feedback");
  const returnTo = customerUI.safeReturn(query.get("returnTo") || query.get("return"));
  const switchLink = document.getElementById("auth-switch");
  switchLink.href += "?returnTo=" + encodeURIComponent(returnTo);
  customerUI.bindToggles();
  const password = form.elements.password;
  function validate() {
    if (!signup) return;
    const phone = form.elements.phone;
    phone.setCustomValidity(
      phone.value &&
        (!/^\+?[\d ()-]+$/.test(phone.value) || phone.value.replace(/\D/g, "").length < 7)
        ? "Enter a phone number containing at least seven digits."
        : "",
    );
    password.setCustomValidity(customerUI.passwordMessage(password.value));
    const confirmation = form.elements.confirm_password;
    confirmation.setCustomValidity(
      confirmation.value !== password.value ? "The passwords do not match." : "",
    );
    const checks = [
      password.value.length >= 10,
      password.value.length >= 16,
      /\d/.test(password.value),
      /[^\w\s]/.test(password.value),
    ];
    const score = checks.filter(Boolean).length;
    document.getElementById("strength").value = score;
    document.getElementById("strength-label").textContent =
      !password.value || !customerUI.validPassword(password.value)
        ? "Use at least 10 characters and at most 72 UTF-8 bytes."
        : score >= 3
          ? "Strong password"
          : "Try a longer passphrase for more strength.";
    if (confirmation.value && confirmation.value !== password.value)
      customerUI.feedback(feedback, "Passwords do not match yet.", true);
    else customerUI.feedback(feedback, "");
  }
  form.addEventListener("input", validate);
  function finish(mergedIds) {
    // The database merge ran in the successful authentication request.
    try {
      const acknowledged = new Set(mergedIds.slice(0, 500));
      const remaining = saved("wish").filter((id) => !acknowledged.has(id));
      if (remaining.length) localStorage.setItem("jsi-wish", JSON.stringify(remaining));
      else localStorage.removeItem("jsi-wish");
    } catch {}
    location.replace(returnTo);
  }
  let pending = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    validate();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    pending = true;
    customerUI.feedback(feedback, signup ? "Creating your account…" : "Signing in…");
    try {
      const payload = customerUI.formData(form);
      payload.wishlist = saved("wish");
      await customerUI.write("/api/auth/" + (signup ? "signup" : "login"), "POST", payload);
      finish(payload.wishlist);
    } catch (error) {
      customerUI.feedback(feedback, error.message, true);
    } finally {
      submit.disabled = false;
      pending = false;
    }
  });
  try {
    const state = await customerUI.session();
    if (state.user) {
      location.replace(returnTo);
      return;
    }
    submit.disabled = false;
    const area = document.getElementById("google-area");
    if (state.google_client_id) {
      area.hidden = false;
      await customerUI.googleButton(
        document.getElementById("google-button"),
        state,
        async (credential) => {
          if (pending) return;
          pending = true;
          submit.disabled = true;
          try {
            const wishlist = saved("wish");
            await customerUI.write("/api/auth/google", "POST", {
              credential,
              wishlist,
            });
            finish(wishlist);
          } finally {
            pending = false;
            submit.disabled = false;
          }
        },
        (error) =>
          customerUI.feedback(
            feedback,
            error.message + " To retry Google sign-in, refresh this page.",
            true,
          ),
      );
    }
  } catch (error) {
    customerUI.feedback(feedback, error.message, true);
  }
})();
