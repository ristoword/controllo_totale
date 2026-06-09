(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  async function getJson(url) {
    const res = await fetch(url, { method: "GET", credentials: "same-origin" });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  var STATUS_LABEL = {
    active: "Attiva",
    trial: "Trial",
    expired: "Scaduta",
    suspended: "Sospesa",
  };

  var STATUS_CLASS = {
    active: "active",
    trial: "trial",
    expired: "expired",
    suspended: "suspended",
  };

  var PLAN_LABEL = {
    controllo_totale_pro: "CT Pro",
    restaurant_only: "Ristorante",
    hotel_only: "Hotel",
    all_included: "All Inclusive",
    pro: "Pro",
  };

  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  }

  function euro(n) {
    if (n === null || n === undefined) return "—";
    return "\u20AC " + Number(n).toFixed(2).replace(".", ",");
  }

  function showError(msg) {
    var box = $("error-box");
    $("error-msg").textContent = msg;
    box.classList.add("visible");
  }

  function hideError() {
    $("error-box").classList.remove("visible");
  }

  function setLoading(loading) {
    var icon = $("refresh-icon");
    if (loading) icon.classList.add("spin");
    else icon.classList.remove("spin");
  }

  function renderDashboard(data) {
    var partner = data.partner;
    var licenses = data.licenses || [];
    var summary = data.summary || {};

    // Partner info
    if (partner) {
      $("partner-info").textContent = partner.name + " \u2014 " + partner.country;
    }

    // Stats
    $("stats-grid").style.display = "";
    $("stat-total").textContent = String(summary.total || 0);
    $("stat-active").textContent = String(summary.active || 0);
    $("stat-expired").textContent = String(summary.expired || 0);
    $("stat-commission").textContent = euro(summary.totalCommissionEuros || 0);

    // Pricing
    if (partner) {
      $("pricing-row").style.display = "";
      $("price-sale").textContent = euro(partner.licensePrice);
      $("price-commission").textContent = euro(partner.commissionEuros);
    }

    // Table
    $("table-loading").style.display = "none";

    if (licenses.length === 0) {
      $("table-empty").style.display = "";
      $("table-content").style.display = "none";
      return;
    }

    $("table-empty").style.display = "none";
    $("table-content").style.display = "";

    var tbody = $("licenses-tbody");
    tbody.innerHTML = "";

    for (var i = 0; i < licenses.length; i++) {
      var row = licenses[i];
      var tr = document.createElement("tr");
      var statusClass = STATUS_CLASS[row.status] || "";
      var statusLabel = STATUS_LABEL[row.status] || row.status;
      var planLabel = PLAN_LABEL[row.plan] || row.plan;
      var commissionHtml = row.status === "active"
        ? '<td class="right commission">' + euro(row.commissionEuros) + "</td>"
        : '<td class="right" style="color:var(--muted)">—</td>';

      tr.innerHTML =
        '<td class="name">' + (row.tenantName || row.tenantId) + "</td>" +
        "<td>" + planLabel + "</td>" +
        "<td>" + fmtDate(row.activatedAt) + "</td>" +
        "<td>" + fmtDate(row.expiresAt) + "</td>" +
        '<td class="right">' + euro(row.licensePrice) + "</td>" +
        commissionHtml +
        '<td class="center"><span class="badge ' + statusClass + '">' + statusLabel + "</span></td>";

      tbody.appendChild(tr);
    }

    // Footer totals
    if (licenses.length > 0) {
      $("licenses-tfoot").style.display = "";
      $("tfoot-total").textContent = euro(summary.totalCommissionEuros || 0);
    }
  }

  async function load() {
    setLoading(true);
    hideError();

    var out = await getJson("/api/super-admin/indonesia/dashboard");

    setLoading(false);

    if (!out.ok) {
      showError((out.data && out.data.error) || "Errore " + out.status);
      return;
    }

    if (out.data && out.data.data) {
      renderDashboard(out.data.data);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    load();

    $("btn-refresh").addEventListener("click", function () {
      load();
    });

    // Create license
    $("btn-create-license").addEventListener("click", async function () {
      var tenant = $("new-tenant-id").value.trim();
      var plan = $("new-plan").value.trim();
      var days = Number($("new-days").value) || 365;
      var msgEl = $("create-msg");

      if (!tenant) {
        msgEl.textContent = "Inserisci un Restaurant ID";
        msgEl.className = "msg err";
        return;
      }

      msgEl.textContent = "Creazione in corso...";
      msgEl.className = "msg";

      var out = await postJson("/api/super-admin/indonesia/license/create", {
        restaurantId: tenant,
        plan: plan,
        days: days,
      });

      if (!out.ok) {
        msgEl.textContent = (out.data && out.data.error) || "Errore";
        msgEl.className = "msg err";
        return;
      }

      msgEl.textContent = "Licenza creata con successo per " + tenant;
      msgEl.className = "msg ok";
      $("new-tenant-id").value = "";
      load();
    });

    // Assign
    $("btn-assign").addEventListener("click", async function () {
      var tenant = $("assign-tenant-id").value.trim();
      var msgEl = $("assign-msg");

      if (!tenant) {
        msgEl.textContent = "Inserisci un Restaurant ID";
        msgEl.className = "msg err";
        return;
      }

      msgEl.textContent = "Assegnazione in corso...";
      msgEl.className = "msg";

      var out = await postJson("/api/super-admin/indonesia/license/assign", {
        restaurantId: tenant,
        partnerCode: "ID-INDO-01",
      });

      if (!out.ok) {
        msgEl.textContent = (out.data && out.data.error) || "Errore";
        msgEl.className = "msg err";
        return;
      }

      msgEl.textContent = "Licenza assegnata a Indonesia per " + tenant;
      msgEl.className = "msg ok";
      $("assign-tenant-id").value = "";
      load();
    });

    // Unassign
    $("btn-unassign").addEventListener("click", async function () {
      var tenant = $("assign-tenant-id").value.trim();
      var msgEl = $("assign-msg");

      if (!tenant) {
        msgEl.textContent = "Inserisci un Restaurant ID";
        msgEl.className = "msg err";
        return;
      }

      msgEl.textContent = "Rimozione in corso...";
      msgEl.className = "msg";

      var out = await postJson("/api/super-admin/indonesia/license/unassign", {
        restaurantId: tenant,
      });

      if (!out.ok) {
        msgEl.textContent = (out.data && out.data.error) || "Errore";
        msgEl.className = "msg err";
        return;
      }

      msgEl.textContent = "Licenza rimossa dal partner Indonesia per " + tenant;
      msgEl.className = "msg ok";
      $("assign-tenant-id").value = "";
      load();
    });
  });
})();
