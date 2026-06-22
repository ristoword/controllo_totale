(function () {
  "use strict";

  var usersCache = [];
  var licensesCache = [];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textOrDash(v) {
    if (v === null || v === undefined) return "—";
    var s = String(v);
    return s.trim().length ? s : "—";
  }

  function formatUptime(seconds) {
    var s = Number(seconds) || 0;
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + "g " + h + "h";
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return String(iso).slice(0, 10);
    } catch (_) {
      return "—";
    }
  }

  function tenantDisplayName(id) {
    var map = {
      "baia-verde": "Baia Verde",
      risto1: "Controllo Totale Demo",
      default: "Default",
    };
    return map[id] || id;
  }

  async function getJson(url) {
    var res = await fetch(url, { method: "GET", credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/super-admin-login";
      throw new Error("401");
    }
    var data = await res.json().catch(function () {
      return null;
    });
    return { ok: res.ok, status: res.status, data: data };
  }

  async function postJson(url, payload) {
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload || {}),
    });
    if (res.status === 401) {
      window.location.href = "/super-admin-login";
      throw new Error("401");
    }
    var data = await res.json().catch(function () {
      return null;
    });
    return { ok: res.ok, status: res.status, data: data };
  }

  function switchTab(tabId) {
    document.querySelectorAll(".sa-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".sa-nav-item[data-tab]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".sa-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + tabId);
    });
  }

  function renderRecentTenants(licenses) {
    var tbody = $("sa-recent-tenants");
    if (!tbody) return;
    var list = (licenses || []).slice(0, 12);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Nessun tenant.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (l) {
        var st = String(l.status || "active").toUpperCase();
        return (
          "<tr><td><strong>" +
          esc(tenantDisplayName(l.restaurantId)) +
          '</strong><br><span class="mono muted">' +
          esc(l.restaurantId) +
          "</span></td><td>" +
          esc(l.plan || "—") +
          '</td><td><span class="status-pill">' +
          esc(st) +
          "</span></td><td class=\"mono\">" +
          esc(formatDate(l.createdAt || l.activatedAt)) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function renderCustomers(customers) {
    var tbody = $("sa-customers-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    var list = Array.isArray(customers) ? customers : [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var tenant = c.restaurantId || "";
      var fullName = [c.name, c.surname].filter(Boolean).join(" ");
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="mono">' +
        esc(tenant) +
        "</td><td>" +
        esc(fullName || "—") +
        '</td><td class="mono">' +
        esc(textOrDash(c.phone)) +
        '</td><td><div class="sa-actions"><button type="button" class="btn primary small" data-sa-act="enter-tenant" data-tenant="' +
        esc(tenant) +
        '">Entra</button><button type="button" class="btn small" data-act="block" data-tenant="' +
        esc(tenant) +
        '">Blocca</button><button type="button" class="btn small" data-act="unblock" data-tenant="' +
        esc(tenant) +
        '">Sblocca</button><button type="button" class="btn danger small" data-act="force-logout" data-tenant="' +
        esc(tenant) +
        '">Logout</button></div></td>';
      tbody.appendChild(tr);
    }
  }

  function renderUsers(usersWrap) {
    var tbody = $("sa-users-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    var users = usersWrap && usersWrap.users ? usersWrap.users : usersWrap || [];
    var list = Array.isArray(users) ? users : [];
    for (var i = 0; i < list.length; i++) {
      var u = list[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="mono">' +
        esc(textOrDash(u.username)) +
        "</td><td>" +
        esc(textOrDash(u.role)) +
        '</td><td class="mono">' +
        esc(textOrDash(u.restaurantId)) +
        '</td><td class="mono">' +
        (u.is_active === false ? "false" : "true") +
        "</td>";
      tbody.appendChild(tr);
    }
    $("kpi-users-total").textContent = String(list.length);
  }

  function renderLicenses(licenses) {
    licensesCache = Array.isArray(licenses) ? licenses : [];
    var tbody = $("sa-licenses-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    for (var i = 0; i < licensesCache.length; i++) {
      var l = licensesCache[i];
      var tenant = String(l.restaurantId || "").trim();
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="mono">' +
        esc(textOrDash(l.restaurantId)) +
        "</td><td>" +
        esc(textOrDash(l.plan)) +
        '</td><td class="mono">' +
        esc(textOrDash(l.status)) +
        '</td><td class="mono">' +
        esc(formatDate(l.expiresAt)) +
        '</td><td><div class="sa-actions"><button type="button" class="btn primary small" data-sa-act="enter-tenant" data-tenant="' +
        esc(tenant) +
        '">Entra</button><button type="button" class="btn small" data-sa-act="open-supervisor" data-tenant="' +
        esc(tenant) +
        '">Supervisor</button></div></td>';
      tbody.appendChild(tr);
    }
    renderRecentTenants(licensesCache);
    var active = licensesCache.filter(function (l) {
      var st = String(l.status || "").toLowerCase();
      return st === "active" || st === "used";
    });
    $("kpi-licenses-active").textContent = String(active.length);
    $("kpi-tenants-active").textContent = String(licensesCache.length);
  }

  function renderPayments(payments) {
    var tbody = $("sa-payments-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    var stripe = payments && payments.stripe ? payments.stripe : {};
    var sessions = stripe.sessionsSample || [];
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="mono">' +
        esc(textOrDash(s.id)) +
        '</td><td class="mono">' +
        esc(textOrDash(s.restaurantId)) +
        "</td><td>" +
        esc(textOrDash(s.plan)) +
        '</td><td class="mono">' +
        esc(textOrDash(s.status)) +
        "</td>";
      tbody.appendChild(tr);
    }
  }

  async function refreshWorkingTenantPill() {
    var el = $("sa-working-tenant");
    if (!el) return;
    var wt = await getJson("/api/super-admin/working-tenant");
    if (wt.ok && wt.data && wt.data.workingTenant) {
      el.textContent = "Tenant attivo: " + wt.data.workingTenant;
    } else {
      el.textContent = "Tenant attivo: default";
    }
  }

  async function setWorkingTenant(tenant) {
    var rid = String(tenant || "").trim();
    if (!rid) return { ok: false };
    return postJson("/api/super-admin/working-tenant", { restaurantId: rid });
  }

  async function loadAll() {
    await refreshWorkingTenantPill();

    var statusOut = await getJson("/api/super-admin/system-status");
    if (statusOut.ok) {
      var s = statusOut.data || {};
      var k = s.kpis || {};
      $("kpi-licenses-active").textContent = textOrDash(k.licensesActive);
      $("kpi-tenants-active").textContent = textOrDash(k.customersCount);
      $("kpi-database").textContent = "Online";
      $("kpi-uptime").textContent = formatUptime(s.server && s.server.uptimeSeconds);
      $("sa-maintenance-toggle").value = s.maintenance && s.maintenance.enabled ? "true" : "false";
      $("sys-time").textContent = textOrDash(s.server && s.server.serverTime);
      $("sys-version").textContent = textOrDash(s.server && s.server.version);
      var stripe = s.stripe || {};
      var pres = stripe.keysPresence || {};
      $("stripe-presence").textContent =
        "secret:" +
        (pres.STRIPE_SECRET_KEY ? "ok" : "—") +
        " webhook:" +
        (pres.STRIPE_WEBHOOK_SECRET ? "ok" : "—");
      var wh = stripe.stripeMock || {};
      $("stripe-webhook-status").textContent = "processed:" + textOrDash(wh.processedCount);
    }

    var customersOut = await getJson("/api/super-admin/customers");
    if (customersOut.ok) {
      renderCustomers(customersOut.data && customersOut.data.customers ? customersOut.data.customers : []);
      renderUsers(customersOut.data && customersOut.data.users ? customersOut.data.users : []);
    }

    var licensesOut = await getJson("/api/super-admin/licenses");
    if (licensesOut.ok) {
      renderLicenses(licensesOut.data && licensesOut.data.licenses ? licensesOut.data.licenses : []);
    }

    var paymentsOut = await getJson("/api/super-admin/payments");
    if (paymentsOut.ok) renderPayments(paymentsOut.data || {});
  }

  function renderGsKpi(stats) {
    var el = $("gs-kpi");
    if (!el || !stats) return;
    var rows = [
      ["Totale", stats.total],
      ["Disponibili", stats.available],
      ["Usati", stats.used],
    ];
    el.innerHTML = rows
      .map(function (r) {
        return '<article class="sa-kpi"><div><div class="sa-kpi-label">' + esc(r[0]) + '</div><div class="sa-kpi-value">' + esc(r[1]) + "</div></div></article>";
      })
      .join("");
    $("gs-meta").textContent = stats.importedAt ? "Sync: " + stats.importedAt : "";
  }

  async function loadGsCodes() {
    var out = await getJson("/api/super-admin/console/gs-codes");
    if (!out.ok || !out.data) return;
    renderGsKpi(out.data.stats);
    var tb = $("gs-table-body");
    var list = out.data.codes || [];
    tb.innerHTML = list.length
      ? list
          .slice(0, 30)
          .map(function (c) {
            return "<tr><td class=\"mono\">" + esc(c.code) + "</td><td>" + esc(c.status) + "</td><td>" + esc(c.assignedEmail || "—") + "</td></tr>";
          })
          .join("")
      : '<tr><td colspan="3" class="muted">Nessun codice</td></tr>';
  }

  async function loadContacts() {
    var out = await getJson("/api/super-admin/console/contacts");
    var tb = $("contacts-table");
    var list = out.ok && out.data && out.data.contacts ? out.data.contacts : [];
    tb.innerHTML = list.length
      ? list.map(function (c) {
          return "<tr><td>" + esc(c.email) + "</td><td>" + esc(c.category) + "</td><td>" + esc(c.note || "—") + "</td></tr>";
        }).join("")
      : '<tr><td colspan="3" class="muted">Nessun contatto</td></tr>';
  }

  async function loadConsoleUsers() {
    var out = await getJson("/api/super-admin/console/users");
    usersCache = out.ok && out.data && out.data.users ? out.data.users : [];
    var tb = $("users-table");
    if (!usersCache.length) {
      tb.innerHTML = '<tr><td colspan="4" class="muted">Nessun utente</td></tr>';
      return;
    }
    tb.innerHTML = usersCache
      .map(function (u) {
        return (
          '<tr><td>' +
          esc(u.username) +
          "</td><td>" +
          esc(u.role) +
          '</td><td class="mono">' +
          esc(u.restaurantId || "—") +
          '</td><td><button type="button" class="btn small primary" data-user-reset="' +
          esc(u.id) +
          '">Reset pwd</button></td></tr>'
        );
      })
      .join("");
    tb.querySelectorAll("[data-user-reset]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Generare nuova password?")) return;
        var out2 = await postJson("/api/super-admin/console/reset-password", {
          userId: btn.getAttribute("data-user-reset"),
          forceMustChange: true,
        });
        if (out2.ok && out2.data && out2.data.temporaryPassword) {
          $("modal-pwd-text").textContent = out2.data.temporaryPassword;
          $("modal-pwd").classList.add("open");
        } else alert((out2.data && out2.data.error) || "Errore");
      });
    });
  }

  async function loadCustTable(q) {
    var url = "/api/super-admin/customers" + (q ? "?q=" + encodeURIComponent(q) : "");
    var out = await getJson(url);
    var customers = (out.data && out.data.customers) || [];
    var tb = $("cust-table");
    if (!customers.length) {
      tb.innerHTML = '<tr><td colspan="3" class="muted">Nessun cliente</td></tr>';
      return;
    }
    tb.innerHTML = customers
      .map(function (c, idx) {
        var label = (c.name || "") + " " + (c.surname || "");
        return (
          '<tr><td class="mono">' +
          esc(c.restaurantId) +
          "</td><td>" +
          esc(label.trim() || "—") +
          '</td><td><button type="button" class="btn small" data-cust-idx="' +
          idx +
          '">Scheda</button></td></tr>'
        );
      })
      .join("");
    tb.querySelectorAll("[data-cust-idx]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-cust-idx"), 10);
        var c = customers[idx];
        if (!c) return;
        $("modal-cust-title").textContent = (c.name || "") + " " + (c.surname || "");
        $("modal-cust-fields").innerHTML =
          "<p><strong>Email:</strong> " +
          esc(c.email || "—") +
          "</p><p><strong>Tel:</strong> " +
          esc(c.phone || "—") +
          "</p><p><strong>Tenant:</strong> " +
          esc(c.restaurantId) +
          "</p>";
        $("modal-cust").classList.add("open");
      });
    });
  }

  async function loadOnlineMonitor() {
    var out = await getJson("/api/super-admin/online");
    if (!out.ok || !out.data) return;
    var d = out.data;
    var s = d.summary || {};
    $("kpi-online-users").textContent = String(s.totalOnline != null ? s.totalOnline : "—");
    $("kpi-online-tenants").textContent = String(s.tenantsOnline != null ? s.tenantsOnline : "—");
    $("kpi-online-sessions").textContent = String(s.activeSessions != null ? s.activeSessions : "—");
    $("sa-online-updated").textContent = "Aggiornato: " + new Date(d.serverTime || Date.now()).toLocaleTimeString("it-IT");
    var tbody = $("sa-online-tbody");
    tbody.innerHTML = "";
    (d.onlineUsers || []).forEach(function (u) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        esc(u.name || u.username) +
        "</td><td>" +
        esc(u.role || "—") +
        '</td><td class="mono">' +
        esc(u.tenantId) +
        "</td><td>" +
        esc(u.department || "—") +
        '</td><td class="mono">' +
        esc(textOrDash(u.lastSeenAt)) +
        "</td>";
      tbody.appendChild(tr);
    });
  }

  async function loadResellers() {
    var out = await getJson("/api/super-admin/reseller/accounts");
    if (!out.ok) return;
    var tbody = $("sa-resellers-tbody");
    tbody.innerHTML = "";
    (out.data && out.data.accounts ? out.data.accounts : []).forEach(function (a) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="mono">' +
        esc(a.username) +
        '</td><td class="mono">' +
        esc(a.partnerCode) +
        "</td><td>" +
        (a.active ? "sì" : "no") +
        "</td>";
      tbody.appendChild(tr);
    });
  }

  async function bootHeader() {
    var me = await getJson("/api/super-admin/me");
    if (me.ok && me.data && me.data.username) {
      var name = String(me.data.username).split(/[._@-]/)[0];
      name = name.charAt(0).toUpperCase() + name.slice(1);
      $("rw-greeting").textContent = "Ciao, " + name;
      $("rw-avatar").textContent = name.slice(0, 2).toUpperCase();
    }
    $("rw-date").textContent = new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function bindTabs() {
    document.querySelectorAll(".sa-tab, .sa-nav-item[data-tab], .sa-quick-card[data-goto]").forEach(function (el) {
      el.addEventListener("click", function () {
        var tab = el.getAttribute("data-tab") || el.getAttribute("data-goto");
        if (tab) switchTab(tab);
      });
    });
  }

  function bindEvents() {
    bindTabs();

    $("sa-btn-logout").addEventListener("click", async function () {
      await postJson("/api/super-admin/logout", {});
      window.location.href = "/super-admin-login";
    });

    $("sa-btn-save-maintenance").addEventListener("click", async function () {
      var enabled = $("sa-maintenance-toggle").value === "true";
      var out = await postJson("/api/super-admin/maintenance/toggle", { enabled: enabled });
      $("sa-maintenance-msg").textContent = out.ok ? "Salvato." : (out.data && out.data.error) || "Errore";
      if (out.ok) await loadAll();
    });

    $("sa-btn-search-customers").addEventListener("click", async function () {
      var q = $("sa-customers-search").value || "";
      var out = await getJson("/api/super-admin/customers?q=" + encodeURIComponent(q));
      if (out.ok) renderCustomers((out.data && out.data.customers) || []);
    });

    $("sa-btn-refresh-customers").addEventListener("click", function () {
      $("sa-customers-search").value = "";
      loadAll();
    });

    function bindTenantActions(tbody) {
      if (!tbody) return;
      tbody.addEventListener("click", async function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        var tenant = btn.getAttribute("data-tenant");
        var act = btn.getAttribute("data-act") || btn.getAttribute("data-sa-act");
        if (!act) return;

        if (act === "enter-tenant") {
          btn.disabled = true;
          await setWorkingTenant(tenant);
          btn.disabled = false;
          await refreshWorkingTenantPill();
          return;
        }
        if (act === "open-supervisor") {
          await setWorkingTenant(tenant);
          window.location.href = "/supervisor/supervisor.html";
          return;
        }
        var map = {
          block: "/api/super-admin/customer/block",
          unblock: "/api/super-admin/customer/unblock",
          "force-logout": "/api/super-admin/customer/force-logout",
        };
        if (map[act]) {
          btn.disabled = true;
          await postJson(map[act], { restaurantId: tenant });
          btn.disabled = false;
          await loadAll();
        }
      });
    }

    bindTenantActions($("sa-customers-tbody"));
    bindTenantActions($("sa-licenses-tbody"));

    $("sa-btn-create-temp-license").addEventListener("click", async function () {
      var out = await postJson("/api/super-admin/license/create-temp", {
        restaurantId: $("sa-license-tenant-id").value.trim(),
        plan: $("sa-license-plan").value.trim(),
        extendDays: Number($("sa-license-days").value) || 30,
        activateImmediately: $("sa-license-activate-now").checked,
      });
      if (!out.ok) alert((out.data && out.data.error) || "Errore");
      else await loadAll();
    });

    $("sa-btn-revoke-license").addEventListener("click", async function () {
      var out = await postJson("/api/super-admin/license/revoke", {
        restaurantId: $("sa-license-revoke-tenant-id").value.trim(),
        reason: $("sa-license-revoke-reason").value,
        suspicious: $("sa-license-revoke-suspicious").checked,
      });
      if (!out.ok) alert((out.data && out.data.error) || "Errore");
      else await loadAll();
    });

    $("sa-btn-save-stripe-config").addEventListener("click", async function () {
      var out = await postJson("/api/super-admin/system-status", {
        values: {
          STRIPE_SECRET_KEY: $("sa-stripe-secret-key-input").value,
          STRIPE_WEBHOOK_SECRET: $("sa-stripe-webhook-secret-input").value,
          STRIPE_PRICE_CONTROLLO_TOTALE_MONTHLY: $("sa-stripe-price-monthly-input").value,
          STRIPE_PRICE_CONTROLLO_TOTALE_ANNUAL: $("sa-stripe-price-annual-input").value,
        },
      });
      $("sa-stripe-save-msg").textContent = out.ok ? "Config salvata." : (out.data && out.data.error) || "Errore";
      if (out.ok) await loadAll();
    });

    $("sa-btn-refresh-online").addEventListener("click", loadOnlineMonitor);
    $("sa-btn-create-reseller").addEventListener("click", async function () {
      var out = await postJson("/api/super-admin/reseller/create-account", {
        username: $("sa-reseller-username").value.trim(),
        password: $("sa-reseller-password").value,
        partnerCode: $("sa-reseller-partner").value.trim(),
        displayName: $("sa-reseller-display").value.trim(),
      });
      $("sa-reseller-msg").textContent = out.ok ? "Creato." : (out.data && out.data.error) || "Errore";
      if (out.ok) await loadResellers();
    });

    $("btn-refresh-codes").addEventListener("click", loadGsCodes);
    $("btn-gen-1").addEventListener("click", async function () {
      await postJson("/api/super-admin/console/gs-codes/generate", { count: 1 });
      await loadGsCodes();
    });
    $("btn-gen-25").addEventListener("click", async function () {
      await postJson("/api/super-admin/console/gs-codes/generate", { count: 25 });
      await loadGsCodes();
    });

    $("btn-contact-add").addEventListener("click", async function () {
      var out = await postJson("/api/super-admin/console/contacts", {
        email: $("contact-email").value.trim(),
        category: $("contact-cat").value,
        note: $("contact-note").value.trim(),
      });
      $("contact-msg").textContent = out.ok ? "Salvato." : (out.data && out.data.error) || "Errore";
      if (out.ok) await loadContacts();
    });

    $("btn-refresh-users").addEventListener("click", loadConsoleUsers);
    $("btn-cust-search").addEventListener("click", function () {
      loadCustTable($("cust-q").value.trim());
    });
    $("btn-cust-refresh").addEventListener("click", function () {
      $("cust-q").value = "";
      loadCustTable("");
    });

    $("btn-ai-assistant").addEventListener("click", function () {
      $("modal-ai").classList.add("open");
    });
    $("modal-ai-close").addEventListener("click", function () {
      $("modal-ai").classList.remove("open");
    });
    $("ai-sa-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = $("ai-sa-input").value.trim();
      if (!msg) return;
      var log = $("ai-sa-log");
      log.innerHTML += "<p><strong>Tu:</strong> " + esc(msg) + "</p>";
      $("ai-sa-input").value = "";
      var out = await postJson("/api/ai/chat", {
        message: msg,
        enableTools: false,
        context: "supervisor",
        locale: "it",
      });
      log.innerHTML += "<p><strong>AI:</strong> " + esc((out.data && out.data.reply) || "Nessuna risposta") + "</p>";
    });

    ["modal-user", "modal-cust", "modal-pwd"].forEach(function (id) {
      var m = $(id);
      if (!m) return;
      m.addEventListener("click", function (e) {
        if (e.target === m) m.classList.remove("open");
      });
    });
    $("modal-user-close").addEventListener("click", function () {
      $("modal-user").classList.remove("open");
    });
    $("modal-cust-close").addEventListener("click", function () {
      $("modal-cust").classList.remove("open");
    });
    $("modal-pwd-close").addEventListener("click", function () {
      $("modal-pwd").classList.remove("open");
    });
    $("modal-pwd-copy").addEventListener("click", function () {
      try {
        navigator.clipboard.writeText($("modal-pwd-text").textContent);
      } catch (_) {}
    });

    $("sa-global-search").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        switchTab("tenants");
        $("sa-customers-search").value = e.target.value;
        $("sa-btn-search-customers").click();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindEvents();
    bootHeader();
    loadAll().catch(function () {});
    loadGsCodes();
    loadContacts();
    loadConsoleUsers();
    loadCustTable("");
    loadOnlineMonitor();
    loadResellers();
    setInterval(loadOnlineMonitor, 30000);
  });
})();
