(function () {
  "use strict";
  var wines = [];
  var booted = false;
  var showBuyPrices = false;

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

  function colorLabel(color) {
    return t("wine_color_" + color) || color;
  }

  function glassIcon(color) {
    var map = {
      rosso: "🍷",
      bianco: "🥂",
      rose: "🌸",
      bollicine: "🍾",
      passito: "🍯",
      orange: "🍊",
    };
    return map[color] || "🍷";
  }

  function bodyLabel(color) {
    if (color === "rosso" || color === "passito") return t("cantina_body_full");
    if (color === "bianco" || color === "bollicine") return t("cantina_body_light");
    if (color === "rose" || color === "orange") return t("cantina_body_medium");
    return "—";
  }

  function localeTag() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en" ? "en-GB" : lang + "-" + lang.toUpperCase();
  }

  function euro(n) {
    return Number(n || 0).toLocaleString(localeTag(), {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    });
  }

  function apiErrorMessage(data, status) {
    if (data && typeof data.message === "string") return data.message;
    if (data && typeof data.error === "string") return data.error;
    if (status === 401) return t("login_error");
    if (status === 403) return t("login_denied");
    return t("error_generic");
  }

  async function api(url, opts) {
    var res = await fetch(
      url,
      Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opts || {})
    );
    var data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok) throw new Error(apiErrorMessage(data, res.status));
    return data;
  }

  function showError(msg) {
    var el = $("cantina-load-error");
    if (!el) return;
    el.textContent = msg || t("error_generic");
    el.style.display = msg ? "block" : "none";
  }

  function updateBadges() {
    var active = wines.filter(function (w) {
      return w.active !== false;
    });
    $("badge-total").textContent = String(active.length);
    $("badge-red").textContent = String(
      active.filter(function (w) {
        return w.color === "rosso";
      }).length
    );
    $("badge-white").textContent = String(
      active.filter(function (w) {
        return w.color === "bianco";
      }).length
    );
  }

  function renderCard(w) {
    var origin = [w.producer, w.region, w.country].filter(Boolean).join(" · ");
    var stock = Number(w.stock) || 0;
    var bottlesLabel = stock === 1 ? t("cantina_bottle_one") : t("cantina_bottle_many");
    var buyHtml =
      showBuyPrices && w.purchasePrice
        ? '<div class="wine-buy-price">' + esc(t("cantina_buy_price")) + ": " + esc(euro(w.purchasePrice)) + "</div>"
        : "";

    return (
      '<article class="wine-card" data-id="' +
      esc(w.id) +
      '">' +
      '<div class="wine-card-head">' +
      '<span class="wine-glass" aria-hidden="true">' +
      glassIcon(w.color) +
      "</span>" +
      '<div class="wine-title-wrap">' +
      "<h3 class=\"wine-title\">" +
      esc(w.name) +
      "</h3>" +
      '<p class="wine-origin">' +
      esc(origin) +
      "</p>" +
      "</div>" +
      '<span class="color-pill ' +
      esc(w.color) +
      '">' +
      esc(colorLabel(w.color).toUpperCase()) +
      "</span>" +
      "</div>" +
      '<dl class="wine-details">' +
      "<div class=\"wine-detail\"><dt>" +
      esc(t("cantina_body")) +
      '</dt><dd>' +
      esc(bodyLabel(w.color)) +
      "</dd></div>" +
      "<div class=\"wine-detail\"><dt>" +
      esc(t("cantina_grape")) +
      '</dt><dd>' +
      esc(w.grape || "—") +
      "</dd></div>" +
      "<div class=\"wine-detail\"><dt>" +
      esc(t("cantina_vintage")) +
      '</dt><dd>' +
      esc(w.vintage || "—") +
      "</dd></div>" +
      "<div class=\"wine-detail\"><dt>" +
      esc(t("cantina_alcohol")) +
      '</dt><dd>' +
      esc(w.alcohol ? w.alcohol + "%" : "—") +
      "</dd></div>" +
      "</dl>" +
      (w.pairings
        ? '<p class="wine-pairings"><strong>' +
          esc(t("cantina_recommended")) +
          "</strong> " +
          esc(w.pairings) +
          "</p>"
        : "") +
      '<div class="wine-card-foot">' +
      '<div class="wine-price-block">' +
      '<div class="price-label">' +
      esc(t("cantina_sale_price_label")) +
      "</div>" +
      '<div class="wine-price">' +
      esc(euro(w.salePrice)) +
      "</div>" +
      buyHtml +
      "</div>" +
      '<div class="wine-stock">🍾 ' +
      esc(stock) +
      " " +
      esc(bottlesLabel) +
      "</div>" +
      "</div>" +
      '<div class="wine-actions">' +
      '<button type="button" class="btn btn-edit" data-edit="' +
      esc(w.id) +
      '">' +
      esc(t("edit")) +
      '</button><button type="button" class="btn btn-del" data-del="' +
      esc(w.id) +
      '">' +
      esc(t("delete")) +
      "</button></div>" +
      (w.notes ? '<p class="wine-note">' + esc(w.notes) + "</p>" : "") +
      "</article>"
    );
  }

  function render() {
    var grid = $("wine-grid");
    if (!wines.length) {
      grid.innerHTML = '<p class="empty-grid">' + esc(t("cantina_empty")) + "</p>";
      updateBadges();
      return;
    }
    grid.innerHTML = wines.map(renderCard).join("");
    grid.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        editWine(btn.getAttribute("data-edit"));
      });
    });
    grid.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deleteWine(btn.getAttribute("data-del"));
      });
    });
    updateBadges();
  }

  function openModal() {
    $("wine-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("wine-modal").hidden = true;
    document.body.style.overflow = "";
  }

  async function loadWines() {
    var q = $("f-search").value.trim();
    var color = $("f-color").value;
    var url = "/api/cantina";
    var params = [];
    if (q) params.push("q=" + encodeURIComponent(q));
    if (color) params.push("color=" + encodeURIComponent(color));
    if (params.length) url += "?" + params.join("&");
    wines = await api(url);
    if (!Array.isArray(wines)) wines = [];
    render();
  }

  function resetForm() {
    $("wine-id").value = "";
    $("form-title").textContent = t("cantina_form_new");
    $("wine-form").reset();
  }

  function editWine(id) {
    var w = wines.find(function (x) {
      return x.id === id;
    });
    if (!w) return;
    $("wine-id").value = w.id;
    $("form-title").textContent = t("cantina_form_edit");
    $("wine-producer").value = w.producer || "";
    $("wine-name").value = w.name || "";
    $("wine-vintage").value = w.vintage || "";
    $("wine-color").value = w.color || "rosso";
    $("wine-region").value = w.region || "";
    $("wine-country").value = w.country || "";
    $("wine-grape").value = w.grape || "";
    $("wine-alcohol").value = w.alcohol || "";
    $("wine-buy").value = w.purchasePrice || "";
    $("wine-sale").value = w.salePrice || "";
    $("wine-stock").value = w.stock || 0;
    $("wine-pairings").value = w.pairings || "";
    $("wine-notes").value = w.notes || "";
    openModal();
  }

  async function deleteWine(id) {
    if (!confirm(t("cantina_delete_confirm"))) return;
    await api("/api/cantina/" + id, { method: "DELETE" });
    await loadWines();
  }

  async function load() {
    showError("");
    try {
      await loadWines();
    } catch (e) {
      showError((e && e.message) || t("cantina_load_error"));
    }
  }

  function bindEvents() {
    $("btn-refresh").addEventListener("click", load);
    $("f-search").addEventListener("input", loadWines);
    $("f-color").addEventListener("change", loadWines);
    $("btn-new").addEventListener("click", function () {
      resetForm();
      openModal();
    });
    $("btn-cancel").addEventListener("click", function () {
      resetForm();
      closeModal();
    });
    $("btn-modal-close").addEventListener("click", closeModal);
    $("wine-modal").addEventListener("click", function (e) {
      if (e.target === $("wine-modal")) closeModal();
    });
    $("btn-toggle-buy").addEventListener("click", function () {
      showBuyPrices = !showBuyPrices;
      $("btn-toggle-buy").classList.toggle("active", showBuyPrices);
      render();
    });
    $("btn-ai").addEventListener("click", async function () {
      try {
        var snap = await api("/api/cantina/ai");
        $("ai-panel").style.display = "";
        $("ai-output").textContent = JSON.stringify(snap, null, 2);
      } catch (e) {
        alert((e && e.message) || t("error_generic"));
      }
    });
    $("btn-ai-close").addEventListener("click", function () {
      $("ai-panel").style.display = "none";
    });
    $("wine-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var payload = {
        producer: $("wine-producer").value.trim(),
        name: $("wine-name").value.trim(),
        vintage: Number($("wine-vintage").value) || null,
        color: $("wine-color").value,
        region: $("wine-region").value.trim(),
        country: $("wine-country").value.trim(),
        grape: $("wine-grape").value.trim(),
        alcohol: Number($("wine-alcohol").value) || null,
        purchasePrice: Number($("wine-buy").value) || 0,
        salePrice: Number($("wine-sale").value) || 0,
        stock: Number($("wine-stock").value) || 0,
        pairings: $("wine-pairings").value.trim(),
        notes: $("wine-notes").value.trim(),
      };
      var id = $("wine-id").value;
      if (id) await api("/api/cantina/" + id, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/cantina", { method: "POST", body: JSON.stringify(payload) });
      resetForm();
      closeModal();
      await load();
    });
    window.addEventListener("i18n:updated", function () {
      render();
      var id = $("wine-id").value;
      $("form-title").textContent = id ? t("cantina_form_edit") : t("cantina_form_new");
    });
  }

  function boot() {
    if (booted) return;
    booted = true;
    bindEvents();
    load();
  }

  document.addEventListener("rw:auth-ready", boot, { once: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
