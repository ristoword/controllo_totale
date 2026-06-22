(function () {
  "use strict";

  var allCustomers = [];
  var activeCategory = "";
  var editingId = null;
  var booted = false;

  function $(id) {
    return document.getElementById(id);
  }

  function t(key) {
    if (typeof window.rwT === "function") return window.rwT(key);
    return key;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function localeTag() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en" ? "en-GB" : lang + "-" + lang.toUpperCase();
  }

  function euro(n) {
    return Number(n || 0).toLocaleString(localeTag(), {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  }

  function typeLabel(cat) {
    var map = {
      vip: "VIP",
      habitue: t("customers.type_habitue"),
      walkin: t("customers.type_walkin"),
      nuovo: t("customers.type_nuovo"),
    };
    return map[cat] || cat || "—";
  }

  function parseArray(val) {
    if (!val || typeof val !== "string") return [];
    return val
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  async function api(url, opts) {
    var res = await fetch(
      url,
      Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opts || {})
    );
    var data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok) throw new Error((data && (data.error || data.message)) || t("error_generic"));
    return data;
  }

  function allergiesText(c) {
    var items = []
      .concat(c.allergies || [])
      .concat(c.intolerances || []);
    return items.length ? items.join(", ") : "";
  }

  function renderTable(items) {
    var tbody = $("customer-tbody");
    if (!items.length) {
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="7">' + esc(t("customers.empty")) + "</td></tr>";
      return;
    }

    tbody.innerHTML = items
      .map(function (c) {
        var fullName = (c.name + " " + (c.surname || "")).trim() || "—";
        var allergy = allergiesText(c);
        return (
          "<tr data-id=\"" +
          esc(c.id) +
          "\">" +
          '<td class="crm-name">' +
          esc(fullName) +
          "</td>" +
          '<td><span class="type-badge ' +
          esc(c.category || "nuovo") +
          '">' +
          esc(typeLabel(c.category).toUpperCase()) +
          "</span></td>" +
          "<td>" +
          esc(c.visits || 0) +
          "</td>" +
          '<td class="spend">' +
          esc(euro(c.totalSpent)) +
          "</td>" +
          "<td>" +
          esc(c.lastVisit || "—") +
          "</td>" +
          "<td>" +
          (allergy ? '<span class="allergy-warn">' + esc(allergy) + "</span>" : "—") +
          "</td>" +
          '<td><button type="button" class="btn-icon" data-del="' +
          esc(c.id) +
          '" aria-label="' +
          esc(t("delete")) +
          '">🗑</button></td>' +
          "</tr>"
        );
      })
      .join("");

    tbody.querySelectorAll("tr[data-id]").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("[data-del]")) return;
        openEdit(row.getAttribute("data-id"));
      });
    });

    tbody.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteCustomer(btn.getAttribute("data-del"));
      });
    });
  }

  function updateKpis(snapshot) {
    var s = snapshot && snapshot.summary ? snapshot.summary : {};
    $("k-total").textContent = String(s.total || 0);
    $("k-vip").textContent = String(s.vip || 0);
    $("k-avg").textContent = euro(s.avgSpend || 0);
    $("k-new").textContent = String(s.newThisMonth || 0);
  }

  async function loadSnapshot() {
    try {
      return await api("/api/customers/ai");
    } catch (_) {
      return null;
    }
  }

  async function loadAndRender() {
    var params = [];
    var q = $("f-search").value.trim();
    if (q) params.push("q=" + encodeURIComponent(q));
    if (activeCategory) params.push("category=" + encodeURIComponent(activeCategory));
    var url = "/api/customers" + (params.length ? "?" + params.join("&") : "");
    allCustomers = await api(url);
    if (!Array.isArray(allCustomers)) allCustomers = [];
    renderTable(allCustomers);
    var snap = await loadSnapshot();
    if (snap) updateKpis(snap);
  }

  function openModal(titleKey) {
    $("modal-title").textContent = t(titleKey);
    $("modal-customer").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("modal-customer").hidden = true;
    document.body.style.overflow = "";
    editingId = null;
  }

  function openAdd() {
    editingId = null;
    $("form-customer").reset();
    $("field-id").value = "";
    $("field-category").value = "nuovo";
    openModal("customers.newCustomer");
  }

  async function openEdit(id) {
    var c = await api("/api/customers/" + id);
    editingId = id;
    $("field-id").value = c.id || "";
    $("field-name").value = c.name || "";
    $("field-surname").value = c.surname || "";
    $("field-phone").value = c.phone || "";
    $("field-email").value = c.email || "";
    $("field-category").value = c.category || "nuovo";
    $("field-visits").value = c.visits || 0;
    $("field-spent").value = c.totalSpent || 0;
    $("field-lastvisit").value = c.lastVisit ? c.lastVisit.slice(0, 10) : "";
    $("field-allergies").value = (c.allergies || []).join(", ");
    $("field-intolerances").value = (c.intolerances || []).join(", ");
    $("field-preferences").value = (c.preferences || []).join(", ");
    $("field-notes").value = c.notes || "";
    openModal("customers.editCustomer");
  }

  async function deleteCustomer(id) {
    if (!confirm(t("customers.delete_confirm"))) return;
    await api("/api/customers/" + id, { method: "DELETE" });
    await loadAndRender();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    var body = {
      name: $("field-name").value.trim(),
      surname: $("field-surname").value.trim(),
      phone: $("field-phone").value.trim(),
      email: $("field-email").value.trim(),
      category: $("field-category").value,
      visits: Number($("field-visits").value) || 0,
      totalSpent: Number($("field-spent").value) || 0,
      lastVisit: $("field-lastvisit").value || "",
      allergies: parseArray($("field-allergies").value),
      intolerances: parseArray($("field-intolerances").value),
      preferences: parseArray($("field-preferences").value),
      notes: $("field-notes").value.trim(),
    };
    if (editingId) await api("/api/customers/" + editingId, { method: "PUT", body: JSON.stringify(body) });
    else await api("/api/customers", { method: "POST", body: JSON.stringify(body) });
    closeModal();
    await loadAndRender();
  }

  function renderAiMini(snapshot) {
    var s = snapshot.summary || {};
    $("ai-kpi-mini").innerHTML =
      '<div class="mini">' +
      esc(t("customers.totalCustomers")) +
      "<strong>" +
      esc(s.total) +
      "</strong></div>" +
      '<div class="mini">VIP<strong>' +
      esc(s.vip) +
      "</strong></div>" +
      '<div class="mini">' +
      esc(t("customers.avgSpend")) +
      "<strong>" +
      esc(euro(s.avgSpend)) +
      "</strong></div>" +
      '<div class="mini">' +
      esc(t("customers.with_allergies")) +
      "<strong>" +
      esc(s.withAllergies) +
      "</strong></div>";
  }

  function addAiMsg(text, role) {
    var el = document.createElement("div");
    el.className = "ai-msg " + (role || "bot");
    el.textContent = text;
    $("ai-chat-log").appendChild(el);
    $("ai-chat-log").scrollTop = $("ai-chat-log").scrollHeight;
  }

  async function openAiModal() {
    $("modal-ai").hidden = false;
    document.body.style.overflow = "hidden";
    $("ai-loading").style.display = "";
    $("ai-content").style.display = "none";
    $("ai-chat-log").innerHTML = "";

    try {
      var locale = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
      var data = await api("/api/customers/ai/insights", {
        method: "POST",
        body: JSON.stringify({ locale: locale, enhance: true }),
      });
      renderAiMini(data.snapshot || {});
      $("ai-insights-text").textContent = data.insights || "";
      $("ai-loading").style.display = "none";
      $("ai-content").style.display = "";
    } catch (e) {
      $("ai-loading").textContent = (e && e.message) || t("customers.ai_error");
    }
  }

  function closeAiModal() {
    $("modal-ai").hidden = true;
    document.body.style.overflow = "";
  }

  async function askAi(message) {
    if (!message.trim()) return;
    addAiMsg(message, "user");
    addAiMsg(t("risto_thinking"), "bot");
    var thinking = $("ai-chat-log").lastElementChild;
    try {
      var locale = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
      var res = await api("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: message,
          enableTools: true,
          context: "supervisor",
          locale: locale,
        }),
      });
      if (thinking && thinking.parentNode) thinking.remove();
      addAiMsg(res.reply || t("risto_error"), "bot");
    } catch (e) {
      if (thinking && thinking.parentNode) thinking.remove();
      addAiMsg(t("risto_error"), "bot");
    }
  }

  function bindEvents() {
    $("btn-add-customer").addEventListener("click", openAdd);
    $("btn-modal-close").addEventListener("click", closeModal);
    $("btn-form-cancel").addEventListener("click", closeModal);
    $("form-customer").addEventListener("submit", handleSubmit);
    $("modal-customer").addEventListener("click", function (e) {
      if (e.target === $("modal-customer")) closeModal();
    });

    $("f-search").addEventListener("input", loadAndRender);

    document.querySelectorAll("#filter-pills .pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("#filter-pills .pill").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        activeCategory = btn.getAttribute("data-cat") || "";
        loadAndRender();
      });
    });

    $("btn-ai").addEventListener("click", openAiModal);
    $("btn-ai-close").addEventListener("click", closeAiModal);
    $("modal-ai").addEventListener("click", function (e) {
      if (e.target === $("modal-ai")) closeAiModal();
    });

    $("ai-chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = $("ai-chat-input").value;
      $("ai-chat-input").value = "";
      askAi(msg);
    });

    document.querySelectorAll(".ai-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        askAi(t(btn.getAttribute("data-q")));
      });
    });

    window.addEventListener("i18n:updated", function () {
      renderTable(allCustomers);
    });
  }

  function boot() {
    if (booted) return;
    booted = true;
    bindEvents();
    loadAndRender().catch(function (e) {
      alert((e && e.message) || t("error_generic"));
    });
  }

  document.addEventListener("rw:auth-ready", boot, { once: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
