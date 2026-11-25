const customerSettings = (() => {
  const h = escapeHTML;
  function renderProfile(root, user) {
    root.innerHTML =
      '<p class="account-muted">Your contact details prefill new studio requests.</p>' +
      '<form id="profile-form" class="account-form"><label for="profile-name">Full name</label><input id="profile-name" name="name" required maxlength="100" autocomplete="name" value="' +
      h(user.name) +
      '">' +
      '<label for="profile-email">Account email</label><input id="profile-email" readonly type="email" value="' +
      h(user.email) +
      '">' +
      '<label for="profile-phone">Phone number</label><input id="profile-phone" name="phone" type="tel" required minlength="7" maxlength="30" autocomplete="tel" value="' +
      h(user.phone || "") +
      '">' +
      '<button type="submit" class="btn">Save profile</button><p class="account-feedback" role="status"></p></form>';
    bindSubmit(root.querySelector("form"), async (form, feedback) => {
      await customerUI.write("/api/user/profile", "PATCH", customerUI.formData(form));
      await customerUI.session(true);
      document.getElementById("sidebar-name").textContent = form.elements.name.value;
      if (typeof refreshCustomerState === "function") await refreshCustomerState();
      customerUI.feedback(feedback, "Profile updated.");
      message("Profile saved.");
    });
  }
  function bindSubmit(form, callback) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submit = form.querySelector("[type=submit]"),
        feedback = form.querySelector(".account-feedback");
      submit.disabled = true;
      try {
        await callback(form, feedback);
      } catch (error) {
        customerUI.feedback(feedback, error.message, true);
      } finally {
        submit.disabled = false;
      }
    };
  }
  const passwordField = (id, label, autocomplete) =>
    '<label for="' +
    id +
    '">' +
    label +
    '</label><div class="password-field"><input id="' +
    id +
    '" name="' +
    id +
    '" type="password" autocomplete="' +
    autocomplete +
    '" required><button type="button" class="password-toggle" aria-controls="' +
    id +
    '" aria-label="Show ' +
    label.toLowerCase() +
    '">Show</button></div>';
  async function renderSettings(root, user) {
    const state = await customerUI.session(true);
    const linked = user.google_linked,
      local = user.has_password;
    const passwordFields =
      (local ? passwordField("current_password", "Current password", "current-password") : "") +
      passwordField("new_password", "New password", "new-password") +
      passwordField("confirm_password", "Confirm new password", "new-password");
    root.innerHTML =
      '<section class="account-settings"><h2>Sign-in methods</h2>' +
      requestView.definitionList([
        ["Email and password", local ? "Enabled" : "No local password"],
        ["Google", linked ? "Connected" : "Not connected"],
      ]) +
      '<div class="account-block"><h3>Verify your identity</h3><p class="account-muted">Verify again before changing your connected sign-in methods.</p>' +
      (local
        ? '<form id="reauth-form" class="account-form">' +
          passwordField("reauth_password", "Account password", "current-password") +
          '<button class="outline" type="submit">Verify password</button><p class="account-feedback" role="status"></p></form>'
        : "") +
      (linked && state.google_client_id
        ? '<button class="outline" id="reauth-google" type="button">Verify connected Google account</button><div id="reauth-button"></div>'
        : "") +
      "</div>" +
      '<div class="account-block"><h3>' +
      (local ? "Change password" : "Set a password") +
      "</h3>" +
      (!local ? '<p class="account-muted">Verify your connected Google account first.</p>' : "") +
      '<form id="password-form" class="account-form">' +
      passwordFields +
      '<small>Use at least 10 characters and at most 72 UTF-8 bytes.</small><button class="btn" type="submit">' +
      (local ? "Change password" : "Save password") +
      '</button><p class="account-feedback" role="status"></p></form></div>' +
      '<div class="account-block"><h3>Connected Google account</h3>' +
      (linked
        ? local
          ? '<p>Removing Google leaves your password sign-in available.</p><button type="button" class="outline" id="unlink-google">Remove Google sign-in</button>'
          : "<p>Set a password before removing Google, your current sign-in method.</p>"
        : state.google_client_id
          ? '<p>Verify your password above, then choose the Google account to connect.</p><label><input style="width:auto;display:inline" type="checkbox" id="confirm-link"> I want to link Google to this customer account.</label><button type="button" class="outline" id="link-google">Choose Google account</button><div id="link-button"></div>'
          : "<p>Google sign-in has not been configured for this studio.</p>") +
      '<p id="google-feedback" role="status"></p></div><div class="account-block"><button class="outline" id="settings-logout" type="button">Sign out of this device</button></div></section>';
    customerUI.bindToggles(root);
    const beforeChanged = async () => {
      const fresh = await customerUI.session(true);
      await renderSettings(root, fresh.user);
    };
    const reauth = root.querySelector("#reauth-form");
    if (reauth)
      bindSubmit(reauth, async (form, feedback) => {
        await customerUI.write("/api/user/reauth", "POST", {
          password: form.elements.reauth_password.value,
        });
        form.reset();
        customerUI.feedback(feedback, "Identity verified for account changes.");
      });
    bindSubmit(root.querySelector("#password-form"), async (form, feedback) => {
      const value = form.elements.new_password.value;
      if (!customerUI.validPassword(value)) throw Error(customerUI.passwordMessage(value));
      if (value !== form.elements.confirm_password.value) throw Error("Passwords must match.");
      if (local)
        await customerUI.write("/api/user/password", "PATCH", {
          current_password: form.elements.current_password.value,
          password: value,
        });
      else await customerUI.write("/api/user/auth/password/set", "POST", { password: value });
      message("Password saved.");
      await beforeChanged();
    });
    const googleFeedback = root.querySelector("#google-feedback");
    const googleError = (error) => customerUI.feedback(googleFeedback, error.message, true);
    async function prepareGoogle(button, container, linking) {
      button.disabled = true;
      try {
        if (linking && !root.querySelector("#confirm-link").checked)
          throw Error("Confirm that you want to link this Google account.");
        const fresh = await customerUI.session(true);
        await customerUI.googleButton(
          container,
          fresh,
          async (credential) => {
            if (linking && !root.querySelector("#confirm-link").checked)
              throw Error("Confirm the link first.");
            await customerUI.write(
              linking ? "/api/user/auth/google/link" : "/api/user/reauth",
              "POST",
              linking ? { credential, confirm: true } : { credential },
            );
            if (linking) {
              message("Google sign-in connected.");
              await beforeChanged();
            } else {
              container.replaceChildren();
              customerUI.feedback(
                googleFeedback,
                "Google identity verified. You can now set a password.",
              );
            }
          },
          googleError,
        );
      } catch (error) {
        googleError(error);
      } finally {
        button.disabled = false;
      }
    }
    const link = root.querySelector("#link-google"),
      verify = root.querySelector("#reauth-google"),
      unlink = root.querySelector("#unlink-google");
    if (link) link.onclick = () => prepareGoogle(link, root.querySelector("#link-button"), true);
    if (verify)
      verify.onclick = () => prepareGoogle(verify, root.querySelector("#reauth-button"), false);
    if (unlink)
      unlink.onclick = async () => {
        unlink.disabled = true;
        try {
          await customerUI.write("/api/user/auth/google/unlink", "POST");
          message("Google sign-in removed.");
          await beforeChanged();
        } catch (error) {
          googleError(error);
        } finally {
          unlink.disabled = false;
        }
      };
    root.querySelector("#settings-logout").onclick = () =>
      document.getElementById("customer-signout").click();
  }
  return { renderProfile, renderSettings };
})();
