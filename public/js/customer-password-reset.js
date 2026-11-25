(function customerPasswordReset() {
  const form = document.getElementById("password-reset");
  const feedback = document.getElementById("reset-feedback");
  const submit = form.querySelector("button[type=submit]");
  const reset = form.dataset.mode === "reset";
  const token = reset && new URLSearchParams(location.hash.slice(1)).get("token");
  if (reset && !/^[a-f0-9]{48}$/.test(token || "")) {
    form.hidden = true;
    customerUI.feedback(feedback, "This reset link is invalid. Request a new one.", true);
    return;
  }

  if (reset) {
    const { password, confirm_password: confirmation } = form.elements;
    form.addEventListener("input", () => {
      password.setCustomValidity(password.value ? customerUI.passwordMessage(password.value) : "");
      confirmation.setCustomValidity(
        confirmation.value && confirmation.value !== password.value ? "Passwords must match." : "",
      );
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    customerUI.feedback(feedback, reset ? "Saving your new password…" : "Requesting a reset link…");
    try {
      const payload = customerUI.formData(form);
      if (reset) payload.token = token;
      const result = await customerUI.write(
        reset ? "/api/auth/reset-password" : "/api/auth/forgot-password",
        "POST",
        payload,
      );
      form.reset();
      if (reset) {
        history.replaceState(null, "", location.pathname);
        form.hidden = true;
        customerUI.feedback(feedback, "Your password was updated. Sign in with your new password.");
      } else {
        customerUI.feedback(feedback, result.message);
      }
    } catch (error) {
      customerUI.feedback(feedback, error.message, true);
    } finally {
      submit.disabled = form.hidden;
    }
  });
  customerUI.session().then(() => {
    submit.disabled = false;
  }).catch((error) => customerUI.feedback(feedback, error.message, true));
})();
