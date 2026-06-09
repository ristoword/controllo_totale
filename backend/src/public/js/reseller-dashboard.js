(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  async function getJson(url) {
    var res = await fetch(url, { method: "GET", credentials: "same-origin" });
    var data = await res.json().catch(function () { return null; });
    return { ok: res.ok, status: res.status, data: data };
  }

  async function postJson(url, payload) {
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload || {}),
    });
    var data = await res.json().catch(function () { return null; });
    return { ok: res.ok, status: res.status, data: data };
  }

  var STATUS_LABEL = { active: "Attiva", trial: "Trial", expired: "Scaduta", suspended: "Sospesa", revoked: "Revocata" };
  var STATUS_CLASS = { active: "active", trial: "trial", expired: "expired", suspended: "suspended", revoked: "revoked" };
  var PLAN_LABEL = { controllo_totale_pro: "CT Pro", restaurant_only: "Ristorante", hotel_only: "Hotel", all_included: "All Inclusive", pro: "Pro" };

  function fmtDate(iso) {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  }

  function euro(n) {
    if (n === null || n === undefined) return "\u2014";
    return "\u20AC " + Number(n).toFixed(2).replace(".", ",");
  }

  function showError(msg) {
    $("error-msg").textContent = msg;
    $("error-box").classList.add("visible");
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

    if (partner) {
      $("partner-info").textContent = partner.name + " \u2014 " + partner.country;
    }

    $("stats-grid").style.display = "";
    $("stat-total").textContent = String(summary.total || 0);
    $("stat-active").textContent = String(summary.active || 0);
    $("stat-expired").textContent = String(summary.expired || 0);
    $("stat-commission").textContent = euro(summary.totalCommissionEuros || 0);

    if (partner) {
      $("pricing-row").style.display = "";
      $("price-sale").textContent = euro(partner.licensePrice);
      $("price-commission").textContent = euro(partner.commissionEuros);
    }

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
        : '<td class="right" style="color:var(--muted)">\u2014</td>';

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

    if (licenses.length > 0) {
      $("licenses-tfoot").style.display = "";
      $("tfoot-total").textContent = euro(summary.totalCommissionEuros || 0);
    }
  }

  async function load() {
    setLoading(true);
    hideError();

    var out = await getJson("/api/reseller/dashboard");

    setLoading(false);

    if (out.status === 401) {
      window.location.href = "/reseller-login";
      return;
    }

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

    $("btn-logout").addEventListener("click", async function () {
      await postJson("/api/reseller/logout", {});
      window.location.href = "/reseller-login";
    });
  });
})();
