const form = document.getElementById("login-form");
const messageBox = document.getElementById("login-message");
const btnLogin = document.getElementById("btn-login");

function t(key) {
  if (typeof window.rwT === "function") return window.rwT(key);
  return key;
}

function showMessage(text, type = "") {
  messageBox.textContent = text || "";
  messageBox.className = "login-message";
  if (type) messageBox.classList.add(type);
}

function getRedirectByRole(role) {
  const r = (role || "").toLowerCase();
  if (r === "owner") return "/dashboard/dashboard.html";
  if (r === "sala" || r === "sala_manager") return "/sala/sala.html";
  if (r === "cucina" || r === "kitchen" || r === "kitchen_manager") return "/cucina/cucina.html";
  if (r === "cassa" || r === "cashier" || r === "cash_manager") return "/cassa/cassa.html";
  if (r === "supervisor") return "/supervisor/supervisor.html";
  if (r === "staff") return "/dashboard/dashboard.html";
  if (r === "bar" || r === "bar_manager") return "/bar/bar.html";
  if (r === "pizzeria") return "/pizzeria/pizzeria.html";
  if (r === "magazzino") return "/magazzino/magazzino.html";
  if (r === "customer") return "/dashboard/dashboard.html";
  return "/dashboard/dashboard.html";
}

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("return");
  if (returnTo && returnTo.startsWith("/")) return returnTo;
  return null;
}

async function submitLogin(payload) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (data && data.error) ||
      (typeof data === "string" && data) ||
      t("login_failed");
    throw new Error(msg);
  }

  return data;
}

const params = new URLSearchParams(window.location.search);

function initLoginMessages() {
  if (params.get("denied") === "1") showMessage(t("login_denied"), "error");
  if (params.get("license") === "required") {
    const msg = document.getElementById("login-message");
    if (msg) msg.innerHTML = t("login_license_required") + ' <a href="/license/license.html" style="color:var(--accent)">' + t("login_license_activate") + "</a>";
  }
  if (params.get("license") === "expired") {
    const msg = document.getElementById("login-message");
    if (msg) msg.innerHTML = t("login_license_expired") + ' <a href="/license/license.html" style="color:var(--accent)">' + t("login_license_renew") + "</a>";
  }
  if (params.get("ownerActivated") === "1") {
    const msg = document.getElementById("login-message");
    if (msg) msg.textContent = t("login_owner_activated");
    if (msg) msg.classList.add("success");
  }
}

if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.whenReady) {
  window.ControlloTotaleI18n.whenReady().then(initLoginMessages);
} else {
  initLoginMessages();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  if (!username || !password) {
    showMessage(t("login_fill_fields"), "error");
    return;
  }

  btnLogin.disabled = true;
  showMessage(t("login_in_progress"));

  try {
    const data = await submitLogin({ username, password, role });

    localStorage.setItem(
      "rw_auth",
      JSON.stringify({
        user: data.user || username,
        role: data.role || role,
        token: data.token || null,
        loginAt: new Date().toISOString()
      })
    );

    showMessage(t("login_success"), "success");

    const redirectTo = getReturnUrl() || data.redirectTo || getRedirectByRole(data.role || role);

    setTimeout(() => {
      window.location.href = redirectTo;
    }, 500);
  } catch (error) {
    console.error("Errore login:", error);
    showMessage(error.message || t("login_error_access"), "error");
  } finally {
    btnLogin.disabled = false;
  }
});